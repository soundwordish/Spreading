let lexicon;
let activeWords = []; 
let grassBlades = [];
let milkweeds = [];

let seedWords = ["meadow", "blossom", "stamen", "corolla", "fern"]; 
const stopWords = ["from", "upon", "into", "this", "that", "with", "they", "them", "have", "been"];

let soundtrack;
let audioStarted = false;

function preload() {
  lexicon = loadJSON('meadow_lexicon.json');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 1);
  textAlign(CENTER, CENTER);
  textFont('Georgia'); 
  
  soundtrack = createAudio('morning_birds.mp3');
  soundtrack.volume(0.6); 

  for (let i = 0; i < width; i += 8) {
    grassBlades.push(new GrassBlade(i));
  }

  for (let i = 0; i < 20; i++) {
    milkweeds.push(new Milkweed());
  }
  
  // Start the very first cluster
  let startWord = random(seedWords);
  spawnSeed(startWord, width / 2, height / 2, true);
  
  setInterval(bloomNextWord, 3500); 
}

function draw() {
  background(45, 10, 98); 

  for (let g of grassBlades) {
    g.update();
    g.display();
  }

  for (let i = activeWords.length - 1; i >= 0; i--) {
    let w = activeWords[i];
    w.update();
    w.display();
    if (w.isDead) activeWords.splice(i, 1);
  }

  for (let m of milkweeds) {
    m.update();
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
    // Clear and restart at mouse position
    activeWords = []; 
    let startWord = random(seedWords);
    spawnSeed(startWord, mouseX, mouseY, true); 
  }
}

// --------------------------------------------------------
// AMOEBA ENGINE
// --------------------------------------------------------

// Spawns the initial anchor word AND its ghosts
function spawnSeed(wordText, x, y, isSpecial = false) {
  let anchor = new WordNode(wordText, x, y, "anchor", 1.0, isSpecial);
  anchor.isBlooming = true;
  anchor.bloomProgress = 1.0;
  activeWords.push(anchor);
  
  spawnGhosts(wordText, x, y);
}

// Spawns only the ghosts around an existing word (Fixes the doubling bug!)
function spawnGhosts(wordText, x, y) {
  if (activeWords.length > 40) {
    let expendableWords = activeWords.filter(w => !w.isSpecial && !w.fadingOut);
    for (let i = 0; i < 5; i++) {
      if (expendableWords[i]) expendableWords[i].fadingOut = true;
    }
  }

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

  // TIGHT CLUSTERING: Back to a smaller radius so they stay grouped
  let radius = random(70, 100); 
  let angleStep = TWO_PI / allGhosts.length;
  let angleOffset = random(TWO_PI); 
  
  for (let i = 0; i < allGhosts.length; i++) {
    let ghostX = x + cos((i * angleStep) + angleOffset) * radius + random(-15, 15);
    let ghostY = y + sin((i * angleStep) + angleOffset) * radius + random(-15, 15);
    
    let ghostNode = new WordNode(
      allGhosts[i].word, 
      ghostX, 
      ghostY, 
      allGhosts[i].type, 
      allGhosts[i].weight,
      allGhosts[i].is_special
    );
    activeWords.push(ghostNode);
  }
}

function bloomNextWord() {
  let ghosts = activeWords.filter(w => 
    !w.isBlooming && 
    !w.fadingOut &&
    w.x > 50 && w.x < width - 50 &&
    w.y > 50 && w.y < height - 80
  );
  
  if (ghosts.length > 0) {
    let chosen = random(ghosts);
    chosen.isBlooming = true;
    // Just spawn ghosts around the chosen word, don't recreate it
    spawnGhosts(chosen.text, chosen.x, chosen.y);
  } else {
    activeWords = [];
    let startWord = random(seedWords);
    spawnSeed(startWord, width / 2, height / 2, true);
  }
}

// --------------------------------------------------------
// CLASSES
// --------------------------------------------------------

class WordNode {
  constructor(text, x, y, type, weight, isSpecial) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.type = type; 
    this.weight = weight; 
    this.isSpecial = isSpecial;
    
    if (this.isSpecial) {
      this.baseSize = random(42, 54); 
    } else if (this.text.length <= 4 || stopWords.includes(this.text)) {
      this.baseSize = 16;             
    } else {
      this.baseSize = random(22, 32); 
    }
    
    this.xOffset = random(1000);
    this.yOffset = random(1000);
    
    // SLOW DRIFT: Drastically reduced speed so clusters don't dissolve
    let driftAngle = random(TWO_PI);
    this.driftX = cos(driftAngle) * random(0.05, 0.15);
    this.driftY = sin(driftAngle) * random(0.05, 0.15);
    
    this.isBlooming = false;
    this.bloomProgress = 0;
    this.fadingOut = false;
    this.fadeAlpha = 1.0;
    this.isDead = false;
  }

  update() {
    if (!this.isSpecial) {
      if (this.x < 50 || this.x > width - 50) this.driftX *= -1;
      if (this.y < 50 || this.y > height - 100) this.driftY *= -1;

      this.x += this.driftX + map(noise(this.xOffset), 0, 1, -0.2, 0.2);
      this.y += this.driftY + map(noise(this.yOffset), 0, 1, -0.2, 0.2);
      this.xOffset += 0.002;
      this.yOffset += 0.002;
    }

    if (this.isBlooming && this.bloomProgress < 1) {
      this.bloomProgress += 0.02; 
    }

    if (this.fadingOut) {
      this.fadeAlpha -= 0.01;
      if (this.fadeAlpha <= 0) this.isDead = true;
    }
  }

  display() {
    let maxSat = map(this.weight, 0, 1, 40, 100); 
    let hueVal = 0;
    
    if (this.type === "semantic") hueVal = 100;      
    else if (this.type === "orthographic") hueVal = 200; 
    else if (this.type === "phonetic") hueVal = 320;     
    
    push();
    if (!this.isBlooming && this.type !== "anchor") {
      fill(0, 0, 50, 0.3 * this.fadeAlpha); 
      textSize(this.baseSize * 0.7); 
    } else {
      let currentSat = lerp(0, maxSat, this.bloomProgress);
      let currentAlpha = lerp(0.3, 1.0, this.bloomProgress) * this.fadeAlpha;
      let currentSize = lerp(this.baseSize * 0.7, this.baseSize, this.bloomProgress); 
      
      if (this.isSpecial) {
        let pulse = map(sin(frameCount * 0.03 + this.xOffset), -1, 1, 0.4, 1.0);
        currentAlpha *= pulse; 
      }
      
      fill(hueVal, currentSat, 100, currentAlpha);
      textSize(currentSize);
    }
    text(this.text, this.x, this.y);
    pop();
  }
}

class GrassBlade {
  constructor(x) {
    this.x = x;
    this.baseHeight = random(40, 120);
    this.noiseOffset = random(1000);
  }
  
  update() {
    this.noiseOffset += 0.005;
  }
  
  display() {
    let sway = map(noise(this.noiseOffset), 0, 1, -20, 20);
    stroke(110, 40, 60, 0.6); 
    strokeWeight(2);
    noFill();
    beginShape();
    vertex(this.x, height);
    quadraticVertex(this.x, height - this.baseHeight / 2, this.x + sway, height - this.baseHeight);
    endShape();
  }
}

class Milkweed {
  constructor() {
    this.reset();
    this.y = random(height); 
  }
  
  reset() {
    this.x = random(width);
    this.y = height + 50;
    this.char = random(['.', ',', ';', ':', '”', '’']);
    this.noiseOffset = random(1000);
    this.speed = random(0.5, 1.5);
    this.size = random(16, 28);
  }
  
  update() {
    this.y -= this.speed;
    this.x += map(noise(this.noiseOffset), 0, 1, -1, 1);
    this.noiseOffset += 0.01;
    if (this.y < -50) this.reset();
  }
  
  display() {
    noStroke();
    fill(0, 0, 20, 0.8); 
    textSize(this.size);
    text(this.char, this.x, this.y);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}