const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = 960;
canvas.height = 540;
ctx.fillStyle = '#1b2a22';
ctx.fillRect(0, 0, canvas.width, canvas.height);
