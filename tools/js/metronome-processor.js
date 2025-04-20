class MetronomeProcessor extends AudioWorkletProcessor{
constructor(){
super()
this.tickIndex=0
this.startTickTime=0
this.beatsPerMeasure=4
this.subdivision=1
this.interval=0.5
this.beatPatterns=[]
this.isRunning=false
this.port.onmessage=e=>{
const d=e.data
if(d.type==='start'){
this.interval=d.interval
this.beatsPerMeasure=d.beatsPerMeasure
this.subdivision=d.subdivision
this.beatPatterns=d.beatPatterns||[]
this.tickIndex=0
this.startTickTime=currentTime+0.05
this.isRunning=true
}else if(d.type==='stop'){
this.isRunning=false
}else if(d.type==='update'){
if(d.interval) this.interval=d.interval
if(d.beatsPerMeasure) this.beatsPerMeasure=d.beatsPerMeasure
if(d.subdivision) this.subdivision=d.subdivision
if(d.beatPatterns) this.beatPatterns=d.beatPatterns
}}
}
process(i,o,p){
if(o.length&&o[0].length) o[0][0].fill(0)
if(this.isRunning){
const now=currentTime
const batch=[]
while(this.startTickTime+this.tickIndex*this.interval<now+0.3){
const t=this.startTickTime+this.tickIndex*this.interval
const total=this.beatsPerMeasure*this.subdivision
const subIdx=this.tickIndex%total
const mainBeat=Math.floor(subIdx/this.subdivision)
const subBeat=subIdx%this.subdivision
const isMain=subBeat===0
let accent=false
let silent=false
if(isMain&&this.beatPatterns.length>mainBeat){
const pat=this.beatPatterns[mainBeat]
accent=pat==='accent'
silent=pat==='silent'
}
batch.push({
time:t,
beatInMeasure:mainBeat,
subBeat:subBeat,
isMainBeat:isMain,
accent:accent,
silent:silent,
measureStart:mainBeat===0&&subBeat===0
})
this.tickIndex++
if(batch.length>=4||t>now+0.25){
this.port.postMessage({type:'batch',events:batch})
batch.length=0
}
}
if(batch.length>0){
this.port.postMessage({type:'batch',events:batch})
}
}
return true
}
}
registerProcessor('metronome-processor',MetronomeProcessor)