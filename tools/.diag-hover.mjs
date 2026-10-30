/**
 * Diagnostic: why does a synthetic mouseover not produce a hover card?
 */
import { spawn } from 'node:child_process'
const NODE='D:\\Programs_Apps\\nodejs\\node.exe'
const CLI='C:\\Users\\<user>\\AppData\\Local\\qc-playwright-mcp\\node_modules\\@playwright\\mcp\\cli.js'
const PROFILE='C:\\Users\\<user>\\AppData\\Local\\qc-playwright-profile'
const URL_ARG=process.argv[2]
const child=spawn(NODE,[CLI,'--viewport-size','1280x800','--user-data-dir',PROFILE],{stdio:['pipe','pipe','pipe']})
const inbox=[];let buffer=''
child.stdout.on('data',(c)=>{buffer+=c.toString();let n=buffer.indexOf('\n')
  while(n>=0){const line=buffer.slice(0,n).trim();buffer=buffer.slice(n+1)
    if(line!==''){try{inbox.push(JSON.parse(line))}catch{}}
    n=buffer.indexOf('\n')}})
const send=(p)=>child.stdin.write(JSON.stringify(p)+'\n')
async function awaitResponse(id,t=120000){const d=Date.now()+t
  while(Date.now()<d){const a=inbox.findIndex(f=>f.id===id);if(a>=0)return inbox.splice(a,1)[0]
    await new Promise(r=>setTimeout(r,80))}throw new Error('timeout')}
let nid=2
async function call(name,args={}){const id=nid++
  send({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}})
  const f=await awaitResponse(id)
  const t=(f.result?.content??[]).filter(p=>p.type==='text').map(p=>p.text).join('\n')
  return t}
async function evaluate(fn){const t=await call('browser_evaluate',{function:fn})
  const a=t.includes('### Result')?t.slice(t.indexOf('### Result')+10):t
  const b=a.split('### Ran Playwright code')[0].trim()
  const m=/^\`\`\`(?:json)?\n([\s\S]*?)\n\`\`\`$/.exec(b)
  try{return JSON.parse(m===null?b:m[1])}catch{return b}}
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
try{
  send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'d',version:'1'}}})
  await awaitResponse(1)
  send({jsonrpc:'2.0',method:'notifications/initialized'})
  await call('browser_navigate',{url:URL_ARG})
  await sleep(5000)
  await evaluate(`() => { const items=[...document.querySelectorAll('[role="treeitem"]')]
    const hit=items.find(e=>(e.innerText??'').includes('锚点')); if(hit)hit.click(); return true }`)
  await sleep(3000)
  const state=await evaluate(`() => {
    const chips=[...document.querySelectorAll('[data-composer-chip="quote-chat"]')]
    return { chipCount: chips.length,
      chipRect: chips.length===0?null:(()=>{const r=chips[0].getBoundingClientRect();return {left:Math.round(r.left),top:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}})(),
      marked: document.querySelectorAll('[data-qc-num]').length,
      cards: document.querySelectorAll('.qc-card').length }
  }`)
  console.log('state:', JSON.stringify(state))
  if(state.chipCount>0){
    // Try three ways of raising the event.
    const r1=await evaluate(`() => {
      const chip=document.querySelector('[data-composer-chip="quote-chat"]')
      chip.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,cancelable:true}))
      return true }`)
    await sleep(600)
    console.log('after synthetic mouseover:', JSON.stringify(await evaluate(`() => ({cards:document.querySelectorAll('.qc-card').length})`)))
    const r2=await evaluate(`() => {
      const chip=document.querySelector('[data-composer-chip="quote-chat"]')
      const ev=new MouseEvent('mouseover',{bubbles:true,cancelable:true,view:window})
      chip.dispatchEvent(ev)
      return true }`)
    await sleep(600)
    console.log('after view:window:', JSON.stringify(await evaluate(`() => ({cards:document.querySelectorAll('.qc-card').length})`)))
    // Try hovering an inner element too.
    const r3=await evaluate(`() => {
      const chip=document.querySelector('[data-composer-chip="quote-chat"]')
      const inner=chip.firstElementChild ?? chip
      inner.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,cancelable:true,view:window}))
      return {tag:inner.tagName} }`)
    await sleep(600)
    console.log('after inner mouseover:', JSON.stringify(await evaluate(`() => ({cards:document.querySelectorAll('.qc-card').length})`)))
  }
}finally{child.kill()}
