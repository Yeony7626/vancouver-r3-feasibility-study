self.window=self;
{const v='?v='+Date.now();importScripts(...['explore.js','floor-design.js','core-layout.js','corridor-network.js','poly-pack.js'].map(f=>f+v));} // fresh modules every launch; the worker must never run stale engine code
self.onmessage=({data})=>{try{const result=CORRIDOR_NETWORK.route({...data,onProgress:progress=>postMessage({progress})});postMessage({result});}catch(error){postMessage({error:error.message});}};
