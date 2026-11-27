'use strict';

// 고도 배열은 data/height-data.js에서 읽는다.
const earthRadius = 6371000;
const latitudeSteps = 90;
const longitudeSteps = 180;
let gl, program, vertexCount;
let positionBuffer, normalBuffer, colorBuffer;
let angle = -0.85;
let running = true;
let previousTime = null;

function radians(degrees) {
    return degrees * Math.PI / 180;
}

// 위도와 경도를 단위 구의 위치로 변환한다.
function unitPosition(latitude, longitude) {
    const lat = radians(latitude);
    const lon = radians(longitude);
    return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function subtract(a, b) {
    return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

function cross(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]);
    return v.map(value => value / length);
}

// 경도는 가로, 위도는 세로 위치로 바꾼다. 인접한 네 표본을 선형 보간한다.
function getHeight(latitude, longitude) {
    const x = ((longitude + 180) % 360 + 360) % 360;
    const y = Math.max(0, Math.min(180, 90 - latitude));
    const x0 = Math.floor(x), x1 = (x0 + 1) % HEIGHT_WIDTH;
    const y0 = Math.floor(y), y1 = Math.min(HEIGHT_HEIGHT - 1, y0 + 1);
    const tx = x - x0, ty = y - y0;
    const a = HEIGHT_VALUES[y0 * HEIGHT_WIDTH + x0];
    const b = HEIGHT_VALUES[y0 * HEIGHT_WIDTH + x1];
    const c = HEIGHT_VALUES[y1 * HEIGHT_WIDTH + x0];
    const d = HEIGHT_VALUES[y1 * HEIGHT_WIDTH + x1];
    const top = a * (1 - tx) + b * tx;
    const bottom = c * (1 - tx) + d * tx;
    // NASA의 0~6400m 스케일로 근사 환산한다. 원본 JPEG의 양자화 오차가 있다.
    return (top * (1 - ty) + bottom * ty) / 255 * 6400;
}

function getPosition(latitude, longitude, scale) {
    const point = unitPosition(latitude, longitude);
    const radius = 1 + getHeight(latitude, longitude) / earthRadius * scale;
    return point.map(value => value * radius);
}

function getColor(latitude, longitude) {
    if (getHeight(latitude, longitude) < 15) return [0.06, 0.29, 0.60];
    const height = getHeight(latitude, longitude);
    if (Math.abs(latitude) > 70 || height > 6000) return [0.91, 0.94, 0.95];
    if (height > 3000) return [0.48, 0.36, 0.23];
    if (height > 1500) return [0.48, 0.52, 0.25];
    return [0.19, 0.52, 0.28];
}

function makeEarth() {
    const positions = [], normals = [], colors = [];
    const scale = Number(document.getElementById('height').value);
    function triangle(a, b, c) {
        let normal = cross(subtract(b.position, a.position), subtract(c.position, a.position));
        if (dot(normal, a.position) < 0) {
            const temp = b; b = c; c = temp;
            normal = normal.map(value => -value);
        }
        normal = normalize(normal);
        for (const vertex of [a,b,c]) {
            positions.push(...vertex.position);
            normals.push(...normal);
            colors.push(...vertex.color);
        }
    }
    const grid = [];
    for (let i=0; i<=latitudeSteps; i++) {
        const row = [];
        const latitude = -90 + i*180/latitudeSteps;
        for (let j=0; j<=longitudeSteps; j++) {
            // 마지막 경도를 -180과 동일하게 만들어 이음매를 일치시킨다.
            const longitude = j === longitudeSteps ? -180 : -180+j*360/longitudeSteps;
            row.push({position:getPosition(latitude, longitude, scale), color:getColor(latitude, longitude)});
        }
        grid.push(row);
    }
    for (let i=0; i<latitudeSteps; i++) {
        for (let j=0; j<longitudeSteps; j++) {
            const a=grid[i][j], b=grid[i+1][j], c=grid[i][j+1], d=grid[i+1][j+1];
            // 극점에서 면적이 0이 되는 삼각형은 제외한다.
            if (i !== 0) triangle(a,b,c);
            if (i !== latitudeSteps-1) triangle(c,b,d);
        }
    }
    vertexCount = positions.length/3;
    for (const [buffer, data] of [[positionBuffer,positions],[normalBuffer,normals],[colorBuffer,colors]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }
    document.getElementById('stats').textContent =
        `NASA 고도 격자 1° / 지구 격자 2° · 삼각형 ${(vertexCount/3).toLocaleString()}개 · 면별 법선 사용`;
}

function compileShader(id, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, document.getElementById(id).textContent);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

function connectAttribute(name, buffer) {
    const location = gl.getAttribLocation(program, name);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
    gl.enableVertexAttribArray(location);
}

function modelMatrix(rotation) {
    const c=Math.cos(rotation), s=Math.sin(rotation);
    return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}

function projectionMatrix(aspect) {
    const f=1/Math.tan(radians(40)/2), near=0.1, far=20;
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)/(near-far),-1, 0,0,2*far*near/(near-far),0]);
}

function render(time) {
    const seconds = previousTime === null ? 0 : Math.min((time-previousTime)/1000,0.1);
    previousTime=time;
    if (running) angle += radians(Number(document.getElementById('speed').value))*seconds;
    const canvas=gl.canvas;
    const pixelRatio=Math.min(window.devicePixelRatio || 1,2);
    const width=Math.round(canvas.clientWidth*pixelRatio), height=Math.round(canvas.clientHeight*pixelRatio);
    if (canvas.width!==width || canvas.height!==height) {canvas.width=width; canvas.height=height;}
    gl.viewport(0,0,width,height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const lightAngle=radians(Number(document.getElementById('light').value));
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'uModel'),false,modelMatrix(angle));
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'uProjection'),false,projectionMatrix(width/height));
    gl.uniform3fv(gl.getUniformLocation(program,'uLightDirection'),[Math.sin(lightAngle),0.35,Math.cos(lightAngle)]);
    gl.drawArrays(gl.TRIANGLES,0,vertexCount);
    requestAnimationFrame(render);
}

function updateLabels() {
    for (const [id,suffix] of [['speed','°/s'],['height','배'],['light','°']]) {
        document.getElementById(id+'-value').textContent=document.getElementById(id).value+suffix;
    }
}

function main() {
    gl=document.getElementById('gl-canvas').getContext('webgl');
    if (!gl) throw new Error('WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속 설정을 확인하세요.');
    program=gl.createProgram();
    gl.attachShader(program,compileShader('vertex-shader',gl.VERTEX_SHADER));
    gl.attachShader(program,compileShader('fragment-shader',gl.FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    positionBuffer=gl.createBuffer(); normalBuffer=gl.createBuffer(); colorBuffer=gl.createBuffer();
    makeEarth();
    connectAttribute('aPosition',positionBuffer); connectAttribute('aNormal',normalBuffer); connectAttribute('aColor',colorBuffer);
    const view=new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-3.5,1]);
    gl.uniformMatrix4fv(gl.getUniformLocation(program,'uView'),false,view);
    gl.clearColor(0.03,0.055,0.085,1);
    gl.enable(gl.DEPTH_TEST);
    document.getElementById('pause').onclick=function() {running=!running; this.textContent=running?'회전 정지':'회전 시작';};
    for (const id of ['speed','height','light']) {
        document.getElementById(id).oninput=function() {updateLabels(); if (id==='height') makeEarth();};
    }
    document.getElementById('reset').onclick=function() {
        angle=-0.85; running=true;
        document.getElementById('speed').value=15;
        document.getElementById('height').value=40;
        document.getElementById('light').value=35;
        document.getElementById('pause').textContent='회전 정지';
        updateLabels(); makeEarth();
    };
    requestAnimationFrame(render);
}

try {main();} catch (error) {document.getElementById('error').textContent=error.message; console.error(error);}
