import fs from 'node:fs/promises';
import path from 'node:path';

export async function savePlayerArtifacts(players, outputRoot) {
  const screenshots = {};
  for (const player of players) {
    const screenshot = path.join(outputRoot, `${player.name}.png`);
    const clip = await player.page.evaluate(() => ({
      x: 0, y: 0, width: window.innerWidth, height: window.innerHeight,
    }));
    await player.page.screenshot({ path: screenshot, clip }).catch(() => {});
    screenshots[player.name] = screenshot;
  }
  return screenshots;
}

export async function savePlayerVideos(players, outputRoot) {
  const videos = {};
  for (const player of players) {
    if (!player.video) continue;
    const videoPath = path.join(outputRoot, `${player.name}.webm`);
    await player.video.saveAs(videoPath);
    videos[player.name] = videoPath;
  }
  return videos;
}

export async function writeMultiviewArtifact({ outputRoot, title, players, videos, timeline, recordingStartedAt }) {
  const timelinePath = path.join(outputRoot, 'timeline.json');
  const htmlPath = path.join(outputRoot, 'multiview.html');
  const payload = {
    title,
    recording_started_at: recordingStartedAt,
    players: players.map((player) => ({
      name: player.name,
      username: player.username,
      offset_ms: player.videoStartedAt - recordingStartedAt,
      video: path.basename(videos[player.name] ?? ''),
    })),
    events: timeline,
  };
  await fs.writeFile(timelinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const embedded = JSON.stringify(payload).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${title}</title><style>
body{margin:0;background:#111827;color:#e5e7eb;font:14px system-ui,sans-serif}header{position:sticky;top:0;z-index:2;background:#0f172a;padding:12px 16px;border-bottom:1px solid #334155}h1{font-size:18px;margin:0 0 8px}.controls{display:flex;gap:8px;align-items:center}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px}.view{position:relative;border:3px solid #334155;border-radius:10px;overflow:hidden;background:#020617}.view.active{border-color:#f59e0b;box-shadow:0 0 0 2px #f59e0b55}.label{position:absolute;top:8px;left:8px;z-index:1;background:#020617cc;padding:4px 8px;border-radius:999px}.view.active .label{background:#b45309}video{display:block;width:100%;aspect-ratio:16/9;background:#000}.event{padding:0 16px 16px;color:#cbd5e1}input[type=range]{flex:1}
</style></head><body><header><h1>${title}</h1><div class="controls"><button id="toggle">播放</button><input id="time" type="range" min="0" step="0.05" value="0"><span id="clock">0.0s</span></div></header><main class="grid" id="grid"></main><p class="event" id="event">等待播放</p>
<script>const data=${embedded};const grid=document.querySelector('#grid');const videos=[];for(const player of data.players){const box=document.createElement('section');box.className='view';box.dataset.player=player.username;box.innerHTML='<span class="label"></span><video muted playsinline preload="metadata"></video>';box.querySelector('.label').textContent=player.name+' / '+player.username;const video=box.querySelector('video');video.src=player.video;grid.append(box);videos.push({video,box,offset:player.offset_ms/1000});}const range=document.querySelector('#time');const clock=document.querySelector('#clock');const eventText=document.querySelector('#event');let playing=false,start=0,origin=0,max=0;Promise.all(videos.map(({video,offset})=>new Promise(resolve=>{video.addEventListener('loadedmetadata',()=>{max=Math.max(max,video.duration+offset);resolve();},{once:true})}))).then(()=>range.max=max);function seek(t){range.value=t;clock.textContent=t.toFixed(1)+'s';for(const item of videos){const local=Math.max(0,t-item.offset);if(Math.abs(item.video.currentTime-local)>.18)item.video.currentTime=Math.min(local,item.video.duration||local);}const current=[...data.events].reverse().find(entry=>entry.at_ms/1000<=t);for(const item of videos)item.box.classList.toggle('active',item.box.dataset.player===current?.player_id);eventText.textContent=current?current.label:'等待场景开始';}function frame(now){if(!playing)return;const t=origin+(now-start)/1000;if(t>=max){playing=false;document.querySelector('#toggle').textContent='播放';seek(max);return}seek(t);requestAnimationFrame(frame)}document.querySelector('#toggle').onclick=()=>{playing=!playing;if(playing){start=performance.now();origin=Number(range.value);document.querySelector('#toggle').textContent='暂停';for(const {video} of videos)video.play().catch(()=>{});requestAnimationFrame(frame)}else{document.querySelector('#toggle').textContent='播放';for(const {video} of videos)video.pause();}};range.oninput=()=>seek(Number(range.value));seek(0);</script></body></html>`;
  await fs.writeFile(htmlPath, html, 'utf8');
  return { htmlPath, timelinePath };
}

export async function writeReport(reportPath, report) {
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
