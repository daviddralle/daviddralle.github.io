'use strict';
// Keep decoded frames attached and hidden; never clear a frame while its successor loads.
class FloodScenarios {
  constructor({stages,createFrame,onProgress=()=>{},onDisplay=()=>{}}) {
    Object.assign(this,{stages,createFrame,onProgress,onDisplay});
    this.frames=new Map();this.failed=new Set();this.version=0;this.displayed=null;
  }
  progress(){this.onProgress({ready:[...this.frames.values()].filter(f=>f.loaded).length,total:this.stages.length,failed:this.failed.size});}
  get(stage){
    if(this.frames.has(stage))return this.frames.get(stage).promise;
    const frame=this.createFrame(stage);this.frames.set(stage,frame);
    frame.promise=Promise.resolve(frame.ready).then(()=>{
      frame.loaded=true;this.failed.delete(stage);this.progress();return frame;
    }).catch(error=>{frame.remove();this.frames.delete(stage);this.failed.add(stage);this.progress();throw error;});
    return frame.promise;
  }
  async show(stage,opacity){
    const version=++this.version;
    let frame;
    try{frame=await this.get(stage);}catch(error){if(version!==this.version)return false;throw error;}
    if(version!==this.version)return false;
    // Both changes happen in one JS turn, before the browser paints.
    frame.show(opacity);
    if(this.displayed&&this.displayed.frame!==frame)this.displayed.frame.hide();
    this.displayed={stage,frame};this.onDisplay(stage);return true;
  }
  hide(){++this.version;if(this.displayed)this.displayed.frame.hide();this.displayed=null;this.onDisplay(null);}
  setOpacity(opacity){if(this.displayed)this.displayed.frame.show(opacity);}
  async preload(center,concurrency=3){
    const queue=this.stages.slice().sort((a,b)=>Math.abs(a-center)-Math.abs(b-center));
    await Promise.all(Array.from({length:concurrency},async()=>{
      while(queue.length){try{await this.get(queue.shift());}catch{/* Selection retries a failed frame. */}}
    }));
  }
}
