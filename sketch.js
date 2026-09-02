let lexicon;
let activeWords = []; 
let grassBlades = [];
let milkweeds = [];

const stopWords = ["from", "upon", "into", "this", "that", "with", "they", "them", "have", "been"];

let soundtrack;
let audioStarted = false;
let isClearing = false; 

// Background Color Variables
let softDawn, skyBlue, sunrisePeach;

function preload() {
  lexicon = loadJSON('meadow_lexicon.json');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER);
  textFont('Georgia'); 
  
  softDawn = color(215, 27, 86);    
  skyBlue = color(193, 60, 100);    
  sunrisePeach = color(17, 41, 100);
  
  soundtrack = createAudio('morning_birds.mp3'); 
  soundtrack.volume(0.6); 

  for (let i = 0; i < width; i += 8) {
    grassBlades.push(new GrassBlade(i)); 
  }

  for (let i = 0; i < 40; i++) {
    milkweeds.push(new MilkweedEntity(random(width), random(height))); 
  }
  
  let allAvailableWords = Object.keys(lexicon);
  let startWord = random(allAvailableWords);
  spawnSeed(startWord, width / 2, height - 100, true); 
  
  setInterval(bloomNextWord, 5500); 
}

function getDynamicBackground() {
  let cycleDuration = 120000; 
  let progress = (millis() % cycleDuration) / cycleDuration;
  
  if (progress < 0.33) {
    return lerpColor(softDawn, skyBlue, map(progress, 0, 0.33, 0, 1)); 
  } else if (progress < 0.66) {
    return lerpColor(skyBlue, sunrisePeach, map(progress, 0.33, 0.66, 0, 1)); 
  } else {
    return lerpColor(sunrisePeach, softDawn, map(progress, 0.66, 1.0, 0, 1)); 
  }
}

function draw() {
  background(getDynamicBackground()); 

  let globalBreeze = map(noise(millis() * 0.0001), 0, 1, -0.015, 0.015); 

  for (let g of grassBlades) {
    g.update(globalBreeze); 
    g.display(); 
  }

  if (isClearing) {
    let allDead = true;
    for (let w of activeWords) {
      if (!w.isDead) {
        allDead = false;
        break;
      }
    }
    if (allDead) {
      isClearing = false;
      activeWords = [];
      let allAvailableWords = Object.keys(lexicon);
      spawnSeed(random(allAvailableWords), width / 2, height - 100, true);
    }
  }

  for (let i = activeWords.length - 1; i >= 0; i--) {
    let w = activeWords[i];
    w.update(globalBreeze); 
    w.display();
    if (w.isDead) activeWords.splice(i, 1); 
  }

  for (let m of milkweeds) {
    m.update(globalBreeze); 
    m.display();
  }
  
  if (!audioStarted) {
    push();
    fill(0, 0, 30, 0.8);
    textSize(18);
    text("Click anywhere to begin audio", width / 2, height - 50); 
    pop();
  }
}

function mousePressed() {
  if (!audioStarted) {
    soundtrack.loop(); 
    audioStarted = true; 
  } else {
    isClearing = false; 
    activeWords = []; 
    let allAvailableWords = Object.keys(lexicon);
    let startWord = random(allAvailableWords);
    spawnSeed(startWord, mouseX, height - 100, true); 
  }
}

// --------------------------------------------------------
// VINE ENGINE
// --------------------------------------------------------

function spawnSeed(wordText, x, y, isSpecial = false) {
  let anchor = new WordNode(wordText, x, y, "anchor", 1.0, isSpecial);
  activeWords.push(anchor); 
  
  spawnGhosts(wordText, x, y);
}

function spawnGhosts(wordText, x, y) {
  let data = lexicon[wordText]; 
  if (!data) return; 

  let allGhosts = [];
  let seenWords = new Set();
  seenWords.add(wordText); 

  const addGhost = (item, type) => {
    if (!seenWords.has(item.word)) {
      seenWords.add(item.word);
      allGhosts.push({...item, type: type});
    }
  };

  if (data.semantic) data.semantic.forEach(item => addGhost(item, "semantic")); 
  if (data.orthographic) data.orthographic.forEach(item => addGhost(item, "orthographic")); 
  if (data.phonetic) data.phonetic.forEach(item => addGhost(item, "phonetic")); 

  allGhosts = shuffle(allGhosts).slice(0, 4); 

  for (let i = 0; i < allGhosts.length; i++) {
    let ghostNode = new WordNode(
      allGhosts[i].word, 
      x + random(-10, 10), 
      y + random(-10, 10), 
      allGhosts[i].type, 
      allGhosts[i].weight,
      allGhosts[i].is_special
    );
    
    let burstAngle = random(TWO_PI);
    ghostNode.vel.x = cos(burstAngle) * random(0.5, 1.5);
    ghostNode.vel.y = sin(burstAngle) * random(0.5, 1.5);
    
    activeWords.push(ghostNode); 
  }
}

function bloomNextWord() {
  if (isClearing) return; 

  let anchors = activeWords.filter(w => w.type === "anchor");
  let lastAnchor = anchors[anchors.length - 1];
  
  if (anchors.length >= 30) {
    isClearing = true;
    for (let w of activeWords) {
      if (w.type === "anchor") {
        w.fadingOut = true; 
      } else {
        w.startEdgeDrift(); 
      }
    }
    return;
  }
  
  if (lastAnchor) {
    let allAvailableWords = Object.keys(lexicon);
    let nextText = random(allAvailableWords); 
    
    let direction = random([-1, 1]); 
    let nextX = lastAnchor.targetY ? lastAnchor.pos.x + random(80, 160) * direction : lastAnchor.pos.x;
    let nextY = lastAnchor.targetY - random(70, 120); 
    
    if (nextX < 100 || nextX > width - 100) {
      nextX = lastAnchor.pos.x + random(80, 160) * (direction * -1);
    }
    nextX = constrain(nextX, 100, width - 100);

    if (nextY < 100) {
      nextY = height - 100;
      nextX = random(200, width - 200);
    }

    spawnSeed(nextText, nextX, nextY, true);
    
  } else {
    let allAvailableWords = Object.keys(lexicon);
    spawnSeed(random(allAvailableWords), random(200, width-200), height - 100, true); 
  }
}

// --------------------------------------------------------
// CLASSES
// --------------------------------------------------------

class WordNode {
  constructor(text, x, y, type, weight, isSpecial) {
    this.text = text;
    this.type = type; 
    this.weight = weight; 
    this.isSpecial = isSpecial;
    
    this.targetY = y;
    this.pos = createVector(x, y); 
    
    if (this.type === "anchor") {
      this.pos.y = this.targetY + 40; 
    }

    this.vel = createVector(0, 0); 
    this.acc = createVector(0, 0); 
    this.noiseOffset = random(1000); 
    this.driftSpeed = random(0.005, 0.012); 
    
    if (this.isSpecial) {
      this.baseSize = random(42, 54); 
    } else if (this.text.length <= 4 || stopWords.includes(this.text)) {
      this.baseSize = 16;             
    } else {
      this.baseSize = random(22, 32); 
    }
    
    this.baseAlpha = 0; 
    this.targetAlpha = this.type === "anchor" ? 1.0 : 0.7; 
    this.currentAlpha = 0;
    
    this.fadingOut = false; 
    this.isDead = false; 
    this.isDriftingEdge = false; 
    
    this.life = random(600, 1200); 
    this.flowerHue = random([320, 340, 10, 45, 280, 300]);
  }

  startEdgeDrift() {
    this.isDriftingEdge = true;
    
    let distLeft = this.pos.x;
    let distRight = width - this.pos.x;
    let distTop = this.pos.y;
    let distBottom = height - this.pos.y;
    let minDist = min(distLeft, distRight, distTop, distBottom);
    
    let speed = random(0.5, 1.2);
    
    if (minDist === distLeft) this.vel = createVector(-speed, random(-0.5, 0.5));
    else if (minDist === distRight) this.vel = createVector(speed, random(-0.5, 0.5));
    else if (minDist === distTop) this.vel = createVector(random(-0.5, 0.5), -speed);
    else if (minDist === distBottom) this.vel = createVector(random(-0.5, 0.5), speed);
  }

  update(globalBreeze) {
    if (this.isDriftingEdge) {
      this.pos.add(this.vel);
      this.baseAlpha -= 0.002; 
      
      if (this.baseAlpha <= 0 || 
          this.pos.x < -50 || this.pos.x > width + 50 || 
          this.pos.y < -50 || this.pos.y > height + 50) {
        this.isDead = true;
      }
      this.currentAlpha = this.baseAlpha;
      return; 
    }

    if (this.type === "anchor") {
      if (this.baseAlpha < this.targetAlpha && !this.fadingOut) {
        this.baseAlpha += 0.01; 
      }
      if (this.fadingOut) {
        this.baseAlpha -= 0.03; 
        if (this.baseAlpha <= 0) this.isDead = true;
      } else {
        this.pos.y = lerp(this.pos.y, this.targetY, 0.03);
      }
      let pulse = map(sin(millis() * 0.002 + this.noiseOffset), -1, 1, 0.7, 1.0);
      this.currentAlpha = this.baseAlpha * pulse;
    } else {
      if (this.baseAlpha < this.targetAlpha && !this.fadingOut) {
        this.baseAlpha += 0.01; 
      }
      if (this.fadingOut) {
        this.baseAlpha -= 0.02; 
        if (this.baseAlpha <= 0) this.isDead = true;
      }
      
      this.life--;
      if (this.life <= 0) this.fadingOut = true;
      
      this.currentAlpha = this.baseAlpha;
      
      this.acc.x += globalBreeze; 
      let angle = noise(this.noiseOffset) * TWO_PI * 2; 
      let noiseForce = p5.Vector.fromAngle(angle); 
      noiseForce.mult(0.01); 
      this.acc.add(noiseForce); 
      this.noiseOffset += this.driftSpeed; 

      this.vel.add(this.acc); 
      this.vel.limit(0.8); 
      this.pos.add(this.vel); 
      this.vel.mult(0.97); 
      this.acc.mult(0); 
    }
  }

  display() {
    if (this.currentAlpha <= 0) return;
    
    let h, s;
    
    if (this.type === "anchor") {
      h = this.flowerHue;
      s = 85; 
    } else {
      h = 0;
      s = 0;  
    }
    
    push();
    fill(h, s, 100, this.currentAlpha); 
    
    textStyle(this.isSpecial || this.type === "anchor" ? BOLD : ITALIC); 
    textSize(this.baseSize);
    text(this.text, this.pos.x, this.pos.y); 
    pop();
  }
}

class GrassBlade {
  constructor(x) {
    this.baseX = x; 
    this.baseY = height; 
    this.bladeHeight = random(40, 120); 
    this.noiseOffset = random(1000); 
    this.tipX = this.baseX; 
    this.tipY = this.baseY - this.bladeHeight; 
  }
  
  update(globalBreeze) {
    let windSway = map(noise(this.noiseOffset), 0, 1, -20, 20); 
    let globalSway = globalBreeze * 1500; 
    
    this.tipX = this.baseX + windSway + globalSway; 
    this.noiseOffset += 0.005; 
  }
  
  display() {
    stroke(110, 40, 60, 0.6); 
    strokeWeight(2); 
    noFill(); 
    bezier(
      this.baseX, this.baseY,  
      this.baseX, this.baseY - this.bladeHeight / 2,  
      this.tipX, this.tipY + this.bladeHeight / 4,  
      this.tipX, this.tipY 
    );
  }
}

class MilkweedEntity {
  constructor(startX, startY) {
    this.char = random(['.', ',', ';', ':', '”', '’']); 
    this.pos = createVector(startX, startY); 
    this.vel = createVector(0, 0); 
    this.acc = createVector(0, 0); 
    this.noiseOffset = random(1000); 
    this.rot = random(TWO_PI); 
    this.rotSpeed = random(-0.01, 0.01); 
    this.baseAlpha = random(0.4, 0.8);
    this.size = random(16, 28); 
    this.driftSpeed = random(0.005, 0.012); 
  }

  update(globalBreeze) {
    let internalWind = map(noise(this.noiseOffset), 0, 1, -0.05, 0.05); 
    this.acc.x += internalWind + globalBreeze; 
    this.acc.y += -0.002; 
    this.noiseOffset += 0.005; 

    this.vel.add(this.acc); 
    this.vel.limit(0.8); 
    this.pos.add(this.vel); 
    this.vel.mult(0.98); 
    this.acc.mult(0); 

    this.rot += this.rotSpeed; 

    if (this.pos.y < -50) {
      this.pos.y = height + 50; 
      this.pos.x = random(width); 
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y); 
    rotate(this.rot); 
    fill(0, 0, 20, this.baseAlpha); 
    noStroke(); 
    textSize(this.size); 
    text(this.char, 0, 0); 
    pop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight); 
  
  // FIX: Clear the old grass and replant across the entire new width
  grassBlades = [];
  for (let i = 0; i < width; i += 8) {
    grassBlades.push(new GrassBlade(i)); 
  }
}