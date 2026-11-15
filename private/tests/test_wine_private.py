import copy
import datetime as dt
from email.message import Message
import http.client
import json
import os
from pathlib import Path
import socket
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import wine_private as w

PAGE, PARENT = 'a' * 32, 'b' * 32
FUTURE = '2099-01-01T00:00:00Z'
POLICY = dict(origin='https://wine.test.ts.net:10002', owner_login='owner@example.test', device_ids=['nDeviceOne'], source_page=PAGE, source_parent=PARENT, authorization_expires_at=FUTURE)

def headers(**updates):
    d = {'Host': 'localhost', 'Tailscale-User-Login': 'owner@example.test', 'X-Forwarded-Host': 'wine.test.ts.net:10002', 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '100.64.0.1', 'Origin': POLICY['origin'], 'Sec-Fetch-Site': 'same-origin', 'X-LifeOS-Client': 'wine-private'}
    d.update(updates)
    h = Message()
    for k, v in d.items():
        if v is not None:
            h[k] = v
    return h

def whois(address):
    return {'UserProfile': {'LoginName': 'owner@example.test'}, 'Node': {'StableID': 'nDeviceOne', 'MachineAuthorized': True, 'KeyExpiry': FUTURE, 'Addresses': [address + '/32'], 'Tags': []}}

def rt(text):
    return [{'type': 'text', 'text': {'content': text}, 'plain_text': text}]

def block(kind, text='', checked=False, child=False):
    return {'id': 'c' * 32, 'type': kind, 'has_children': child, kind: {'rich_text': rt(text), **({'checked': checked} if kind == 'to_do' else {})}}

def listing(blocks, more=False, cursor=None):
    return {'results': blocks, 'has_more': more, 'next_cursor': cursor}

def reader(blocks, hook=None):
    def transport(path):
        if path.startswith('pages/'):
            return {'id': PAGE, 'parent': {'type': 'data_source_id', 'data_source_id': PARENT}, 'archived': False, 'in_trash': False}
        return hook(path) if hook else listing(blocks)
    return w.NotionReader('not-a-secret-fixture', PAGE, PARENT, transport)

class IdentityTests(unittest.TestCase):
    def check_denied(self, h=None, uid=0, policy=None, lookup=whois, method='GET', status=403):
        with self.assertRaises(w.Failure) as e:
            w.authorize(h or headers(), uid, policy or POLICY, method, w.API_PATH, lookup)
        self.assertEqual(e.exception.status, status)

    def test_explicit_owner_device_allowed(self):
        self.assertEqual(w.authorize(headers(), 0, POLICY, 'GET', w.API_PATH, whois), 'nDeviceOne')

    def test_direct_socket_spoofing_denied(self):
        self.check_denied(uid=1000)

    def test_absent_login_401(self):
        self.check_denied(headers(**{'Tailscale-User-Login': None}), status=401)

    def test_foreign_owner(self):
        self.check_denied(headers(**{'Tailscale-User-Login': 'foreign@example.test'}))

    def test_unapproved_tagged_expired_or_unapproved_machine(self):
        for change in [{'StableID': 'nOther'}, {'Tags': ['tag:server']}, {'KeyExpiry': '2020-01-01T00:00:00Z'}, {'MachineAuthorized': False}, {'KeyExpiry': None}]:
            def lookup(a):
                d = whois(a); d['Node'].update(change); return d
            with self.subTest(change=change): self.check_denied(lookup=lookup)

    def test_whois_mismatch_or_unavailable(self):
        def mismatch(a):
            d=whois(a);d['UserProfile']['LoginName']='other@example.test';return d
        self.check_denied(lookup=mismatch)
        self.check_denied(lookup=lambda _: (_ for _ in ()).throw(TimeoutError()))

    def test_origins_forwarding_funnel_header_duplicates(self):
        for change in [{'Origin': 'https://foreign.example'}, {'Sec-Fetch-Site': 'same-site'}, {'X-LifeOS-Client': None}, {'X-Forwarded-Proto': 'http'}, {'X-Forwarded-Host': 'other.ts.net:10000'}, {'Host': 'attacker.test'}, {'X-Forwarded-For': '100.64.0.1, 100.64.0.2'}, {'Tailscale-Funnel-Request': 'true'}]:
            with self.subTest(change=change): self.check_denied(headers(**change))
        h=headers();h['Tailscale-User-Login']='owner@example.test';self.check_denied(h)

    def test_expired_policy_and_write_method(self):
        p=copy.deepcopy(POLICY);p['authorization_expires_at']='2020-01-01T00:00:00Z';self.check_denied(policy=p)
        self.check_denied(method='POST', status=405)

class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.start = block('heading_2', 'À acheter — Vinification (test)')
        self.end = block('heading_2', 'Unrelated groceries')

    def test_wine_unchecked_only_not_recipe_or_groceries(self):
        bs=[block('to_do','Ordinary grocery — 2 L'),self.start,block('to_do','Test nutrient — 4 g for trial'),block('to_do','Completed — 3 kg',True),block('paragraph','Planned recipe addition — 7 kg'),self.end,block('to_do','Ordinary grocery — 9 kg')]
        result=reader(bs).read();self.assertEqual(len(result['items']),1);self.assertEqual(result['items'][0]['name'],'Test nutrient');self.assertEqual(result['items'][0]['quantity'],'4');self.assertEqual(result['items'][0]['unit'],'g')
        self.assertEqual(set(result),{'items','fetchedAt'})

    def test_rich_text_and_conditions_and_approximation(self):
        b=block('to_do');b['to_do']['rich_text']=rt('Test powder — environ 4,5 kg ')+[{'type':'mention','plain_text':'for a trial'}]+rt(' CONDITIONNEL: seulement si le plan est maintenu.')
        item=reader([self.start,b,self.end]).read()['items'][0]
        self.assertEqual(item['quantity'],'environ 4,5');self.assertEqual(item['classification'],'conditional');self.assertIn('seulement si',item['condition'])

    def test_pagination_and_boundaries_across_pages(self):
        def pages(path):
            return listing([block('to_do','Trial item — 8 packs'),self.end,block('to_do','Other — 2 L')]) if 'start_cursor=' in path else listing([self.start],True,'f'*32)
        result=reader([],pages).read();self.assertEqual([i['name'] for i in result['items']],['Trial item'])

    def test_higher_heading_boundary_and_empty(self):
        result=reader([self.start,block('heading_1','Different area'),block('to_do','Other — 2 L')]).read();self.assertEqual(result['items'],[])

    def test_missing_duplicate_and_malformed_not_empty_success(self):
        for bs in [[self.end],[self.start,self.end,self.start],[self.start,{'type':'to_do','to_do':{'checked':'false','rich_text':rt('Trial — 4 L')}}]]:
            with self.subTest(bs=bs),self.assertRaises(w.Failure): reader(bs).read()

    def test_nested_restrictions_and_completed_parent(self):
        parent=block('to_do','Trial salt — 4 g',child=True)
        def pages(path):
            if path.startswith('blocks/'+PAGE):return listing([self.start,parent,self.end])
            return listing([block('paragraph','Only if the trial is kept.')])
        result=reader([],pages).read();self.assertEqual(result['items'][0]['classification'],'conditional');self.assertIn('Only if',result['items'][0]['condition'])
        parent['to_do']['checked']=True;self.assertEqual(reader([],pages).read()['items'],[])

    def test_synthetic_add_and_check_changes_next_read(self):
        bs=[self.start,self.end];r=reader(bs);self.assertEqual(r.read()['items'],[])
        b=block('to_do','Synthetic trial — 5 g');bs.insert(1,b);self.assertEqual(len(r.read()['items']),1)
        b['to_do']['checked']=True;self.assertEqual(r.read()['items'],[])

    def test_unknown_quantities_need_review(self):
        item=reader([self.start,block('to_do','Unspecified equipment'),self.end]).read()['items'][0]
        self.assertEqual(item['classification'],'review');self.assertEqual(item['quantity'],'')

    def test_sanitization_and_no_raw_metadata(self):
        item=reader([self.start,block('to_do','Trial — 2 L https://private.example/'+PAGE+' <script>x</script> '+('ntn_'+'x'*30)),self.end]).read()['items'][0]
        value=json.dumps(item);self.assertNotIn(PAGE,value);self.assertNotIn('https:',value);self.assertNotIn('ntn_',value);self.assertNotIn('<script>',value)
        self.assertEqual(set(item),{'name','quantity','unit','purpose','classification','condition'})

    def test_containment_cursor_and_size_failures(self):
        r=reader([]);r.transport=lambda _: {'id':PAGE,'parent':{'type':'page_id','page_id':'d'*32}}
        with self.assertRaises(w.Failure):r.read()
        def cycle(_):return listing([self.start],True,'f'*32)
        with self.assertRaises(w.Failure):reader([],cycle).read()
        with self.assertRaises(w.Failure):reader([self.start,block('to_do','x'*8001)]).read()

    def test_rate_and_concurrency(self):
        r=reader([]);r.lock.acquire()
        try:
            with self.assertRaises(w.Failure) as e:r.read()
            self.assertEqual(e.exception.status,429)
        finally:r.lock.release()

class PolicyAndHttpTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.folder=Path(self.temp.name);self.policy=self.folder/'policy.json';self.policy.write_text(json.dumps(POLICY));self.policy.chmod(0o600)
        self.dist=self.folder/'dist';self.dist.mkdir();(self.dist/'index.html').write_text('<h1>Private synthetic</h1>')
    def tearDown(self):self.temp.cleanup()
    def test_policy_permissions_and_empty_devices(self):
        self.assertEqual(w.load_policy(self.policy),POLICY)
        self.policy.chmod(0o644)
        with self.assertRaises(ValueError):w.load_policy(self.policy)
        self.policy.chmod(0o600);p=copy.deepcopy(POLICY);p['device_ids']=[];self.policy.write_text(json.dumps(p))
        with self.assertRaises(ValueError):w.load_policy(self.policy)
    def request(self,server,path):
        c=http.client.HTTPConnection('unix',timeout=3);c.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);c.sock.connect(server.server_address);c.request('GET',path);r=c.getresponse();result=(r.status,dict(r.getheaders()),r.read());c.close();return result
    def test_real_unprivileged_socket_denied_even_with_no_http_auth(self):
        if os.getuid()==0:self.skipTest('Requires unprivileged test runner')
        with w.WineServer(str(self.folder/'socket'),self.policy,self.dist,'synthetic') as server:
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                status,h,body=self.request(server,w.API_PATH);self.assertEqual(status,403);self.assertEqual(json.loads(body),{'error':'forbidden'});self.assertIn('no-store',h['Cache-Control']);self.assertNotIn('Access-Control-Allow-Origin',h)
            finally:server.shutdown();thread.join()
    def test_http_success_empty_and_safe_error_with_synthetic_authorization(self):
        with w.WineServer(str(self.folder/'socket'),self.policy,self.dist,'synthetic') as server:
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                with patch.object(w,'authorize',return_value='nSynthetic'):
                    with patch.object(server.reader,'read',return_value={'items':[],'fetchedAt':'2030-01-01T00:00:00Z'}):
                        status,h,body=self.request(server,w.API_PATH);self.assertEqual(status,200);self.assertEqual(json.loads(body)['items'],[]);self.assertIn("frame-ancestors 'none'",h['Content-Security-Policy'])
                    for failure in [w.Failure(503,'source_access_unavailable'),w.Failure(504,'upstream_timeout'),RuntimeError('PRIVATE SECRET MUST NOT LEAK')]:
                        with patch.object(server.reader,'read',side_effect=failure):
                            status,h,body=self.request(server,w.API_PATH);self.assertGreaterEqual(status,500);self.assertNotIn(b'PRIVATE',body)
                    self.assertEqual(self.request(server,'/api/v1/wine-supplies?id=other')[0],404)
                    self.assertEqual(self.request(server,w.APP_PATH+'../../policy.json')[0],404)
            finally:server.shutdown();thread.join()


class UpstreamTests(unittest.TestCase):
    def test_status_timeout_malformed_and_boundaries(self):
        class Response:
            def __init__(self,status=200,raw=b'{}'):
                self.status,self.raw=status,raw
            def read1(self,n):
                result=self.raw[:n];self.raw=self.raw[n:];return result
        class Conn:
            def __init__(self,res):self.res=res;self.sock=None;self.request_args=None
            def request(self,*args,**kwargs):self.request_args=(args,kwargs)
            def getresponse(self):return self.res
            def close(self):pass
        for status,expected in [(401,503),(403,503),(404,503),(429,503),(500,502),(302,502)]:
            conn=Conn(Response(status))
            with self.subTest(status=status),patch.object(w.http.client,'HTTPSConnection',return_value=conn):
                r=w.NotionReader('not-a-real-token',PAGE,PARENT)
                with self.assertRaises(w.Failure) as e:r._get('pages/'+PAGE,w.time.monotonic()+12)
                self.assertEqual(e.exception.status,expected);self.assertEqual(conn.request_args[0][0],'GET')
        for raw in [b'not json',b'[]',b'x'*524289]:
            with patch.object(w.http.client,'HTTPSConnection',return_value=Conn(Response(200,raw))):
                with self.assertRaises(w.Failure):w.NotionReader('not-real',PAGE,PARENT)._get('pages/'+PAGE,w.time.monotonic()+12)
        conn=Conn(Response())
        with patch.object(conn,'getresponse',side_effect=TimeoutError()),patch.object(w.http.client,'HTTPSConnection',return_value=conn):
            with self.assertRaises(w.Failure) as e:w.NotionReader('not-real',PAGE,PARENT)._get('pages/'+PAGE,w.time.monotonic()+12)
            self.assertEqual(e.exception.status,504)
        with self.assertRaises(w.Failure) as e:w.NotionReader('not-real',PAGE,PARENT)._get('pages/'+PAGE,w.time.monotonic()-1)
        self.assertEqual(e.exception.status,504)

if __name__=='__main__':unittest.main()
