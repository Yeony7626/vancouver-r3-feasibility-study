self.window=self;
{const v='?v='+Date.now();importScripts(...['rules.js','explore.js','floor-design.js','core-layout.js','corridor-network.js','poly-pack.js','plan-setup.js'].map(f=>f+v));} // fresh modules every launch, as in corridor-worker.js
// One plan-search job per message (PLAN_SETUP.task): fit one stair-and-lift arrangement, or fit and refine it.
self.onmessage=async({data})=>{try{postMessage({id:data.id,result:await PLAN_SETUP.task(data.task)});}catch(error){postMessage({id:data.id,error:error.message});}};
