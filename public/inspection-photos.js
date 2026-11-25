'use strict';

const inspectionPhotoBatches = new WeakSet();
const inspectionPhotoLimit = 100;
const inspectionPhotoTypes = new Set(['image/jpeg','image/png','image/webp']);

async function compressImage(file, maxBytes = 160 * 1024) {
  const image = new Image();
  const url = URL.createObjectURL(file);
  const canvas = document.createElement('canvas');
  try {
    await new Promise((resolve,reject) => {
      image.onload = resolve;
      image.onerror = () => reject(Error('Formato de imagem indisponível. Use JPEG, PNG ou WebP.'));
      image.src = url;
    });
    const longest = Math.max(image.naturalWidth,image.naturalHeight);
    const context = canvas.getContext('2d',{alpha:false});
    if (!longest || !context) throw Error('Não foi possível preparar a imagem.');
    const attempts = [[1600,.84],[1600,.7],[1280,.74],[1024,.7],[800,.65],[640,.58],[480,.5],[320,.46]];
    let previousScale = 0;
    for (const [edge,quality] of attempts) {
      const scale = Math.min(1,edge/longest);
      if (scale !== previousScale) {
        canvas.width = Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
        context.fillStyle = '#fff';
        context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        previousScale = scale;
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',quality));
      if (!blob) throw Error('Não foi possível gerar uma cópia JPEG.');
      if (blob.size <= maxBytes) return blob;
    }
    throw Error('A imagem ainda ocupa muito espaço para este envio.');
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    URL.revokeObjectURL(url);
  }
}

function inspectionPhotoBudget(blobs, bytes) {
  const sizes = blobs.map(blob => inspectionPhotoTypes.has(blob.type) ? blob.size : Infinity).sort((a,b) => a-b);
  for (const [index,size] of sizes.entries()) {
    const share = Math.floor(bytes/(sizes.length-index));
    if (size>share) return share;
    bytes -= size;
  }
  return Infinity;
}

async function addPhotos(files,target='') {
  const record = cur();
  if (!record || !files.length) return;
  const session = googleSession;
  const isCurrent = () => session===googleSession && records.includes(record);
  const startingView = view;
  const status = document.getElementById('photoProcessing');
  if (inspectionPhotoBatches.has(record)) {
    alert('Aguarde a otimização do lote atual antes de anexar outras fotos.');
    return;
  }
  const selected = Array.from(files).slice(0,Math.max(0,inspectionPhotoLimit-record.photos.length));
  if (selected.length<files.length) alert('A inspeção aceita até '+inspectionPhotoLimit+' fotos. Serão adicionadas '+selected.length+'.');
  if (!selected.length) return;
  const failures = [];
  inspectionPhotoBatches.add(record);
  try {
    for (const [index,file] of selected.entries()) {
      if (!isCurrent()) return;
      if (status) status.textContent = 'Otimizando '+(index+1)+' de '+selected.length+' fotos…';
      try {
        const blob = await compressImage(file);
        if (!isCurrent()) return;
        const id = 'PH-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
        await putPhoto({id,blob});
        if (!isCurrent()) return;
        record.photos.push({id,name:file.name,category:target?'Item vinculado':'Geral',target,caption:'',created:new Date().toISOString()});
        change(record);
      } catch (error) {
        failures.push(file.name);
        console.error(error);
      }
    }
  } finally {
    inspectionPhotoBatches.delete(record);
    if (isCurrent()) flushLocalSave();
    if (isCurrent() && cur()===record && (view==='fotos'||view===startingView)) {
      render();
      const progress = document.getElementById('photoProcessing');
      if (progress) progress.textContent = (selected.length-failures.length)+' foto(s) anexada(s).';
    }
  }
  if (isCurrent() && failures.length) {
    const names = failures.slice(0,3).join(', ');
    alert('Não foi possível anexar '+failures.length+' foto(s): '+names+(failures.length>3?'…':'')+'. Tente um arquivo JPEG, PNG ou WebP.');
  }
}
