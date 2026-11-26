// Latest-state delivery: reliable final answers retain their separate outbox.
export function createDraftDelivery({send,ready,makeId=()=>crypto.randomUUID(),schedule=setTimeout,cancel=clearTimeout,interval=180,retry=1000}){
 let roundId=null,latest=null,confirmed=null,inflight=null,timer=null;
 function stop(){if(timer!==null)cancel(timer);timer=null;}
 function later(ms){if(timer===null)timer=schedule(()=>{timer=null;pump();},ms);}
 function pump(){
  if(!ready()||!roundId||latest===null||latest===confirmed)return;
  if(inflight){inflight=null;} // acknowledgement timeout: send only newest state
  const packet={roundId,requestId:makeId(),answer:latest};inflight=packet;
  try{if(send(packet)===false){inflight=null;later(interval);return;}}catch{inflight=null;later(retry);return;}
  if(inflight===packet)later(retry);
 }
 return {
  setRound(id){if(id===roundId)return;stop();roundId=id;latest=confirmed=inflight=null;},
  offer(id,answer){if(id!==roundId||typeof answer!=='string'||answer===latest)return;latest=answer;if(!inflight)later(interval);},
  reconnect(){stop();inflight=null;confirmed=null;if(latest!==null)later(interval);},
  pause(){stop();inflight=null;},
  ack(m){if(!inflight||m.roundId!==roundId||m.requestId!==inflight.requestId)return;stop();const packet=inflight;inflight=null;
   if(m.status==='accepted')confirmed=packet.answer;
   else if(['closed','stale-round','invalid-answer'].includes(m.status))confirmed=packet.answer;
   if(latest!==confirmed)later(m.status==='accepted'?interval:retry);
  }
 };
}
