import copy
import datetime as dt
from email.utils import format_datetime
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs

from test_wine_private import headers, whois, POLICY, FUTURE, w


class DeviceAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.node = whois('100.64.0.1')['Node']
        del self.node['MachineAuthorized']
        self.node['Key'] = 'nodekey:synthetic-key'
        self.device = dict(nodeId='nDeviceOne', authorized=True, user='owner@example.test',
                           addresses=['100.64.0.1'], nodeKey=self.node['Key'], expires=FUTURE, tags=[])
        self.token = dict(access_token='tskey-fixture-access-only', token_type='Bearer', expires_in=3600, scope='devices:core:read')
        self.calls = []
        self.status, self.date, self.age = 200, None, '0'
        self.api = w.DeviceAuthorization('client-id-fixture', 'client-secret-fixture', POLICY['device_ids'], self.transport)

    def transport(self, method, path, h, body):
        self.calls.append((method, path, h, body))
        date = self.date or format_datetime(dt.datetime.now(dt.timezone.utc), usegmt=True)
        return self.status, {'Date': date, 'Age': self.age}, json.dumps(self.token if method == 'POST' else self.device).encode()

    def lookup(self, address):
        result = whois(address); result['Node'] = copy.deepcopy(self.node); return result

    def authorize(self):
        return w.authorize(headers(), POLICY, 'GET', w.API_PATH, self.lookup, self.api)

    def denied(self):
        with self.assertRaises(w.Failure) as error:
            self.authorize()
        self.assertEqual(error.exception.status, 403)

    def test_omission_requires_fresh_explicit_authorization(self):
        self.assertEqual(self.authorize(), 'nDeviceOne')
        self.assertEqual(self.authorize(), 'nDeviceOne')
        self.assertEqual([c[0] for c in self.calls], ['POST', 'GET', 'GET'])
        form = parse_qs(self.calls[0][3])
        self.assertEqual(form['scope'], ['devices:core:read']); self.assertNotIn('tags', form)
        self.assertTrue(all(c[1] in ['/api/v2/oauth/token', '/api/v2/device/nDeviceOne'] for c in self.calls))
        self.device['authorized'] = False
        self.denied()  # No cached positive device status.

    def test_explicit_machine_false_or_malformed_never_calls_api(self):
        for value in [False, None, 'true', 'false', 1, 0]:
            self.node['MachineAuthorized'] = value
            with self.subTest(value=value): self.denied()
        self.assertEqual(self.calls, [])
        self.node['MachineAuthorized'] = True
        self.assertEqual(self.authorize(), 'nDeviceOne'); self.assertEqual(self.calls, [])

    def test_owner_device_address_tags_or_expiry_fail_before_api(self):
        original = copy.deepcopy(self.node)
        for change in [{'StableID':'nOther'}, {'User':456}, {'Addresses':['100.64.0.2/32']}, {'Tags':['tag:other']}, {'KeyExpiry':'2000-01-01T00:00:00Z'}]:
            self.node = {**original, **change}
            with self.subTest(change=change): self.denied()
        self.assertEqual(self.calls, [])

    def test_missing_or_contradictory_api_identity_denies(self):
        original = copy.deepcopy(self.device)
        for field in ['nodeId','authorized','user','addresses','nodeKey','expires']:
            self.device=copy.deepcopy(original); del self.device[field]
            with self.subTest(missing=field): self.denied()
        for change in [{'authorized':False}, {'authorized':1}, {'authorized':'true'}, {'nodeId':'nOther'}, {'user':'other@example.test'}, {'addresses':['100.64.0.2']}, {'addresses':['100.64.0.1','100.64.0.1']}, {'nodeKey':'nodekey:rotated'}, {'expires':'2000-01-01T00:00:00Z'}, {'expires':'2098-01-01T00:00:00Z'}, {'tags':['tag:other']}, {'tags':None}]:
            self.device={**original, **change}
            with self.subTest(change=change): self.denied()

    def test_missing_local_key_denies_fallback(self):
        del self.node['Key']; self.denied()

    def test_stale_or_failed_api_does_not_use_previous_success(self):
        self.assertEqual(self.authorize(), 'nDeviceOne')
        for status in [301,401,403,404,429,500,503]:
            self.status=status
            with self.subTest(status=status):self.denied()
        self.status=200; self.date='Mon, 01 Jan 2001 00:00:00 GMT';self.denied()
        self.date=None;self.age='1';self.denied()

    def test_token_scope_expiry_and_type_checked(self):
        original=copy.deepcopy(self.token)
        for change in [{'scope':'devices:core'}, {'scope':'devices:core:read auth_keys'}, {'scope':''}, {'expires_in':0}, {'expires_in':True}, {'expires_in':3601}, {'token_type':'Other'}, {'access_token':'invalid'}, {'access_token':'tskey-'}]:
            self.token={**original,**change};self.api.token=None
            with self.subTest(change=change):self.denied()

    def test_short_lived_token_renewed_only_in_memory(self):
        self.authorize();self.api.token_until=0;self.authorize()
        self.assertEqual([c[0] for c in self.calls], ['POST','GET','POST','GET'])

    def test_operation_boundary_and_unapproved_id(self):
        self.assertFalse(self.api.verify({**self.node,'StableID':'nOther'},whois('100.64.0.1')['UserProfile']))
        self.assertEqual(self.calls,[])
        for method,path in [('POST','/api/v2/device/nDeviceOne/authorized'),('GET','/api/v2/tailnet/-/devices'),('GET','/api/v2/device/nOther')]:
            with self.subTest(path=path),self.assertRaises(ValueError):self.api.request(method,path,{})

    def test_malformed_and_unavailable_transport(self):
        for transport in [lambda *a: (200, {}, b'{}'), lambda *a: (200, {'Date':format_datetime(dt.datetime.now(dt.timezone.utc),usegmt=True)}, b'[]'), lambda *a: (_ for _ in ()).throw(TimeoutError())]:
            self.api.transport=transport; self.api.token=None
            self.denied()

    def test_real_http_client_uses_only_fixed_tls_host_and_bounded_reads(self):
        class Response:
            status=200
            def __init__(self,raw):self.raw=raw
            def getheaders(self):return [('Date',format_datetime(dt.datetime.now(dt.timezone.utc),usegmt=True))]
            def read1(self,n):
                result,self.raw=self.raw[:n],self.raw[n:];return result
        class Conn:
            sock=None
            def __init__(self):self.calls=[]
            def request(self,*a,**kw):self.calls.append((a,kw))
            def getresponse(self):return Response(b'{"authorized":true}')
            def close(self):pass
        conn=Conn();self.api.transport=None
        with patch.object(w.http.client,'HTTPSConnection',return_value=conn) as factory:
            self.assertEqual(self.api.request('GET','/api/v2/device/nDeviceOne',{}),{'authorized':True})
            factory.assert_called_once_with('api.tailscale.com',timeout=4)
        self.assertEqual(conn.calls[0][0],('GET','/api/v2/device/nDeviceOne'))


class HiddenEntryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path=Path(__file__).resolve().parents[1]/'deploy/enter-tailscale-oauth.py'
        spec=importlib.util.spec_from_file_location('oauth_entry',path);cls.helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.helper)

    def test_exclusive_pair_permissions_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            self.helper.save_pair(folder,'fixture-id','fixture-secret')
            for name in ['tailscale-oauth-id','tailscale-oauth-secret']:
                p=Path(folder)/name;self.assertEqual(p.stat().st_mode&0o777,0o600)
            with self.assertRaises(FileExistsError):self.helper.save_pair(folder,'replacement','replacement')
            self.assertEqual((Path(folder)/'tailscale-oauth-id').read_text(),'fixture-id\n')

    def test_partial_failure_retains_existing_secret_and_removes_only_new_id(self):
        with tempfile.TemporaryDirectory() as folder:
            secret=Path(folder)/'tailscale-oauth-secret';secret.write_text('existing');secret.chmod(0o600)
            with self.assertRaises(FileExistsError):self.helper.save_pair(folder,'fixture-id','fixture-secret')
            self.assertFalse((Path(folder)/'tailscale-oauth-id').exists());self.assertEqual(secret.read_text(),'existing')

    def test_unsafe_directory_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            os.chmod(folder,0o755)
            with self.assertRaises(ValueError):self.helper.save_pair(folder,'fixture-id','fixture-secret')


if __name__=='__main__':unittest.main()
