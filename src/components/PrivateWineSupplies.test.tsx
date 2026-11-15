import {render, screen, within, act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import PrivateWineSupplies from './PrivateWineSupplies';
const at='2030-01-01T12:00:00Z';
const item={name:'Synthetic nutrient',quantity:'4',unit:'g',purpose:'for a synthetic trial',classification:'confirmed',condition:''};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
async function click(){await userEvent.click(screen.getByRole('button',{name:'Refresh from LifeOS'}));}
describe('Private live shopping client (synthetic transport; not real-source acceptance)',()=>{
 it('does not fetch until requested, then shows live response and conditional restrictions without purchase controls',async()=>{
  const fetch=vi.fn().mockResolvedValue(response({items:[item,{...item,name:'Synthetic fruit',quantity:'about 7',unit:'L',classification:'conditional',purpose:'Only if trial is retained.',condition:'Only if trial is retained.'}],fetchedAt:at}));vi.stubGlobal('fetch',fetch);render(<PrivateWineSupplies/>);
  expect(fetch).not.toHaveBeenCalled();expect(screen.getByText(/Last successful refresh:/)).toHaveTextContent('never');await click();
  expect(await screen.findByRole('heading',{name:'Confirmed purchases'})).toBeVisible();expect(screen.getByRole('heading',{name:'Conditional purchases'})).toBeVisible();expect(screen.getByText('4 g')).toBeVisible();expect(screen.getByText(/Conditional — confirm before buying/)).toBeVisible();expect(screen.getByRole('status')).toHaveTextContent('Refresh successful.');expect(document.querySelector('time')).toHaveAttribute('datetime',at);
  expect(fetch).toHaveBeenCalledWith('/api/v1/wine-supplies',expect.objectContaining({cache:'no-store',credentials:'omit',redirect:'error'}));expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(localStorage.length).toBe(0);
 });
 it('replaces results on the next success and clears them for a successful empty response',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response({items:[item],fetchedAt:at})).mockResolvedValueOnce(response({items:[{...item,name:'New synthetic item'}],fetchedAt:'2030-01-01T12:01:00Z'})).mockResolvedValueOnce(response({items:[],fetchedAt:'2030-01-01T12:02:00Z'}));vi.stubGlobal('fetch',fetch);render(<PrivateWineSupplies/>);await click();await screen.findByText('Synthetic nutrient');await click();await screen.findByText('New synthetic item');expect(screen.queryByText('Synthetic nutrient')).not.toBeInTheDocument();await click();expect(await screen.findByText(/No outstanding winemaking purchases/)).toBeVisible();expect(screen.queryByText('New synthetic item')).not.toBeInTheDocument();
 });
 it.each([401,403,429,502,503,504])('keeps prior data visibly stale without changing timestamp after HTTP %s',async(status)=>{
  const fetch=vi.fn().mockResolvedValueOnce(response({items:[item],fetchedAt:at})).mockResolvedValueOnce(response({error:'detail must not be displayed'},status));vi.stubGlobal('fetch',fetch);render(<PrivateWineSupplies/>);await click();await screen.findByText('Synthetic nutrient');await click();expect(await screen.findByRole('alert')).toHaveTextContent('Previous results are stale');expect(document.querySelector('time')).toHaveAttribute('datetime',at);expect(screen.getByText('Synthetic nutrient')).toBeVisible();expect(screen.queryByText('detail must not be displayed')).not.toBeInTheDocument();
 });
 it('handles offline and network failures without claiming any successful refresh',async()=>{
  const fetch=vi.fn().mockRejectedValue(new TypeError('private internal exception'));vi.stubGlobal('fetch',fetch);render(<PrivateWineSupplies/>);await click();expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach LifeOS');expect(screen.getByText(/Last successful refresh:/)).toHaveTextContent('never');vi.spyOn(navigator,'onLine','get').mockReturnValue(false);await click();expect(screen.getByRole('alert')).toHaveTextContent('offline');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('rejects malformed responses and private identifiers rather than advancing freshness',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(response({items:[{...item,purpose:'https://private.example/'}],fetchedAt:at})).mockResolvedValueOnce(response({items:[item],fetchedAt:'invalid'})).mockResolvedValueOnce(new Response('not json',{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetch);render(<PrivateWineSupplies/>);
  for(let i=0;i<3;i++){await click();expect(await screen.findByRole('alert')).toHaveTextContent('incomplete response');expect(screen.getByText(/Last successful refresh:/)).toHaveTextContent('never');}
 });
 it('shows loading, prevents duplicate reads, and times out with no success stamp',async()=>{
  vi.useFakeTimers();const fetch=vi.fn((_u,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));vi.stubGlobal('fetch',fetch);render(<PrivateWineSupplies/>);
  await act(async()=>{screen.getByRole('button',{name:'Refresh from LifeOS'}).click();});expect(screen.getByRole('button',{name:'Refreshing…'})).toBeDisabled();expect(screen.getByRole('status')).toHaveTextContent('Reading');await act(async()=>{await vi.advanceTimersByTimeAsync(15000);});expect(screen.getByRole('alert')).toHaveTextContent('did not respond in time');expect(screen.getByText(/Last successful refresh:/)).toHaveTextContent('never');expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('renders data as text and puts unknown requirements in a review group',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response({items:[{...item,name:'<img src=x onerror=alert(1)>',quantity:'',unit:'',classification:'review'}],fetchedAt:at})));render(<PrivateWineSupplies/>);await click();const group=await screen.findByRole('list',{name:'Purchases needing clarification'});expect(within(group).getByText('Quantity to confirm')).toBeVisible();expect(group.querySelector('img')).toBeNull();
 });
});
