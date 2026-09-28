let lexicon;
let activeWords = []; 
let grassBlades = [];
let milkweeds = [];
let usedAnchors = []; 

// Variables for the text file
let botanyIndexRaw;
let validBotanyAnchors = [];

const stopWords = ["from", "upon", "into", "this", "that", "with", "they", "them", "have", "been"];

let soundtrack;
let audioStarted = false;

// NEW: Independent Column State Machine
let currentTick = 0; 
let stepTimer; 
let columnGen = [1, 1, 1]; // Tracks the generation state of each zone (1, 2, 3, 4, or 0 for resting)

// Background Color Variables
let softDawn, skyBlue, sunrisePeach;

function preload() {
  lexicon = loadJSON('meadow_lexicon.json');
  botanyIndexRaw = loadStrings('underscored_botany_index.txt'); 
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
  
  // PREPARE THE BOTANICAL SEED LIST
  let allBotanyPhrases = botanyIndexRaw
    .join('\n')
    .toLowerCase()
    .split(/[\n,]+/) 
    .map(w => w.trim()); 
    
  validBotanyAnchors = allBotanyPhrases.filter(w => w.length > 0 && lexicon[w]);
  
  if (validBotanyAnchors.length === 0) {
    console.warn("⚠️ No valid matches between botany_index.txt and the JSON! Falling back to full dictionary.");
    validBotanyAnchors = Object.keys(lexicon);
  }

  resetMeadow(); 
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

function getZoneCenter(zoneIndex) {
  let zoneWidth = width / 3;
  return (zoneIndex * zoneWidth) + (zoneWidth / 2);
}

function resetMeadow() {
  activeWords = [];
  usedAnchors = []; 
  currentTick = 0;
  columnGen = [1, 1, 1]; // Reset all columns to generation 1
  
  console.log("=========================================");
  console.log("🌱 MEADOW ENGINE STARTED");
  console.log("=========================================");
  
  if (stepTimer) clearInterval(stepTimer);
  
  executeNextStep(); 
  stepTimer = setInterval(executeNextStep, 10000); 
}

function draw() {
  background(getDynamicBackground()); 

  let globalBreeze = map(noise(millis() * 0.0001), 0, 1, -0.015, 0.015); 

  for (let g of grassBlades) {
    g.update(globalBreeze); 
    g.display(); 
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
    resetMeadow(); 
  }
}

// --------------------------------------------------------
// DECOUPLED COLUMN LADDER ENGINE
// --------------------------------------------------------

function executeNextStep() {
  let zoneIndex = currentTick % 3; 
  let gen = columnGen[zoneIndex]; 
  const ghostProgression = [6, 5, 4, 3]; 

  console.log(`\n--- TICK ${currentTick + 1} (Zone ${zoneIndex}, Gen State ${gen}) ---`);

  if (gen > 4) {
    // End of natural cycle. Clear it, and let it rest for one turn.
    console.log(`🌸 Zone ${zoneIndex} complete. Fading out...`);
    clearZone(zoneIndex);
    columnGen[zoneIndex] = 0; 
  } 
  else if (gen === 1 || gen === 0) {
    // GENERATION 1 (Or waking up from a rest phase)
    let fallback = random(validBotanyAnchors);
    let attempts = 0;
    while(usedAnchors.includes(fallback) && attempts < 50) {
      fallback = random(validBotanyAnchors);
      attempts++;
    }
    
    let startX = getZoneCenter(zoneIndex);
    let startY = height - 100; 
    
    spawnSeed(fallback, startX, startY, true, zoneIndex, ghostProgression[0]); 
    columnGen[zoneIndex] = 2; // Next step will be Gen 2
  } 
  else {
    // GENERATION 2, 3, or 4
    let numGhosts = ghostProgression[gen - 1];
    
    let validGhosts = activeWords.filter(w => 
      w.type !== "anchor" && 
      !w.isDead && 
      !w.isDriftingEdge && 
      !w.fadingOut &&
      !usedAnchors.includes(w.text) &&
      w.zoneIndex === zoneIndex
    );
    
    let selectedGhosts = shuffle(validGhosts).sort((a, b) => a.weight - b.weight).slice(0, 1);
    
    if (selectedGhosts.length === 0) {
      console.warn(`⚠️ Dead end in Zone ${zoneIndex}. Clearing early.`);
      clearZone(zoneIndex);
      columnGen[zoneIndex] = 0; // Force into a resting phase
    } else {
      let chosenGhost = selectedGhosts[0];
      chosenGhost.transformToAnchor(numGhosts);
      columnGen[zoneIndex]++; // Advance to next generation
    }
  }

  currentTick++;
}

// Helper function to trigger fading in a specific column
function clearZone(zoneIndex) {
  for (let w of activeWords) {
    if (w.zoneIndex === zoneIndex) {
      if (w.type === "anchor") w.fadingOut = true;
      else w.startEdgeDrift();
    }
  }
}

function spawnSeed(wordText, x, y, isSpecial, zoneIndex, maxGhosts) {
  usedAnchors.push(wordText); 
  let anchor = new WordNode(wordText, x, y, "anchor", 1.0, isSpecial, zoneIndex);
  activeWords.push(anchor); 
  
  spawnGhosts(wordText, x, y, zoneIndex, maxGhosts);
}

function spawnGhosts(wordText, x, y, zoneIndex, maxGhosts) {
  let data = lexicon[wordText]; 
  if (!data) return; 

  let allGhosts = [];
  let seenWords = new Set();
  seenWords.add(wordText); 

  const addGhost = (item, type) => {
    let alreadyBloomed = usedAnchors.includes(item.word);
    let alreadyFloating = activeWords.some(w => w.text === item.word && !w.isDead && !w.fadingOut);
    
    if (!seenWords.has(item.word) && !alreadyBloomed && !alreadyFloating) {
      seenWords.add(item.word);
      allGhosts.push({...item, type: type});
    }
  };

  if (data.semantic) data.semantic.forEach(item => addGhost(item, "semantic")); 
  if (data.orthographic) data.orthographic.forEach(item => addGhost(item, "orthographic")); 
  if (data.phonetic) data.phonetic.forEach(item => addGhost(item, "phonetic")); 

  allGhosts = shuffle(allGhosts).slice(0, maxGhosts); 

  for (let i = 0; i < allGhosts.length; i++) {
    let ghostNode = new WordNode(
      allGhosts[i].word, 
      x, 
      y, 
      allGhosts[i].type, 
      allGhosts[i].weight,
      allGhosts[i].is_special,
      zoneIndex 
    );
    
    let burstAngle = random(PI, TWO_PI); 
    ghostNode.vel.x = cos(burstAngle) * random(1.0, 2.5);
    ghostNode.vel.y = sin(burstAngle) * random(1.5, 3.0); 
    
    activeWords.push(ghostNode); 
  }
}

// --------------------------------------------------------
// CLASSES
// --------------------------------------------------------

class WordNode {
  constructor(text, x, y, type, weight, isSpecial, zoneIndex) {
    this.text = text;
    this.type = type; 
    this.weight = weight; 
    this.isSpecial = isSpecial;
    this.zoneIndex = zoneIndex; 
    
    this.pos = createVector(x, y); 
    
    this.targetX = x;
    this.targetY = y;
    
    if (this.type === "anchor") {
      this.pos.y = this.targetY + 20; 
    }

    this.vel = createVector(0, 0); 
    this.acc = createVector(0, 0); 
    this.noiseOffset = random(1000); 
    this.driftSpeed = random(0.005, 0.012); 
    
    if (this.type === "anchor") {
      this.baseSize = random(55, 75); 
    } else if (this.isSpecial) {
      this.baseSize = random(30, 38); 
    } else if (this.text.length <= 4 || stopWords.includes(this.text)) {
      this.baseSize = 16;             
    } else {
      this.baseSize = random(22, 28); 
    }
    
    this.baseAlpha = 0; 
    this.targetAlpha = this.type === "anchor" ? 1.0 : 0.7; 
    this.currentAlpha = 0;
    
    this.fadingOut = false; 
    this.isDead = false; 
    this.isDriftingEdge = false; 
    
    this.maxLife = random(12000, 16000); 
    this.life = this.maxLife; 
    this.flowerHue = random([320, 340, 10, 45, 280, 300]);
  }

  transformToAnchor(maxGhosts) {
    this.type = "anchor";
    this.vel.set(0, 0);        
    this.acc.set(0, 0);
    this.baseSize = random(55, 75); 
    this.flowerHue = random([320, 340, 10, 45, 280, 300]); 
    this.targetAlpha = 1.0;
    
    let highestYInZone = height;
    let zoneAnchors = activeWords.filter(w => w.type === "anchor" && w.zoneIndex === this.zoneIndex && w !== this && !w.fadingOut);
    for (let a of zoneAnchors) {
      if (a.targetY < highestYInZone) highestYInZone = a.targetY;
    }
    
    if (this.pos.y > highestYInZone - 80) {
      this.targetY = highestYInZone - random(130, 170);
    } else {
      this.targetY = this.pos.y; 
    }
    this.targetX = this.pos.x;

    let allAnchors = activeWords.filter(w => w.type === "anchor" && w !== this && !w.fadingOut);
    let overlap = true;
    let attempts = 0;
    
    while(overlap && attempts < 20) {
      overlap = false;
      for (let a of allAnchors) {
        let d = dist(this.targetX, this.targetY, a.targetX, a.targetY);
        if (d < 160) { 
          overlap = true;
          if (this.targetX < a.targetX) {
            this.targetX -= 40;
          } else {
            this.targetX += 40;
          }
          this.targetY -= 20; 
        }
      }
      attempts++;
    }
    
    this.targetX = constrain(this.targetX, 80, width - 80);
    this.targetY = constrain(this.targetY, 80, height - 80);

    usedAnchors.push(this.text); 
    spawnGhosts(this.text, this.targetX, this.targetY, this.zoneIndex, maxGhosts); 
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
        this.pos.x = lerp(this.pos.x, this.targetX, 0.04);
        this.pos.y = lerp(this.pos.y, this.targetY, 0.04);
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
      
      let targetX = getZoneCenter(this.zoneIndex);
      let distToCenter = targetX - this.pos.x;
      this.acc.x += distToCenter * 0.00002; 
      this.acc.y -= 0.002;                  
      
      this.noiseOffset += this.driftSpeed; 

      this.vel.add(this.acc); 
      this.vel.limit(1.2);  
      this.pos.add(this.vel); 
      this.vel.mult(0.985); 
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
    textStyle(this.type === "anchor" ? BOLD : ITALIC); 
    textSize(this.baseSize);
    
    let formattedText;
    if (this.text.length > 12) {
      formattedText = this.text.replace(/_/g, '\n'); 
    } else {
      formattedText = this.text.replace(/_/g, ' ');  
    }
    
    text(formattedText, this.pos.x, this.pos.y); 
    
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
    bezier(this.baseX, this.baseY, this.baseX, this.baseY - this.bladeHeight / 2, this.tipX, this.tipY + this.bladeHeight / 4, this.tipX, this.tipY);
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
  grassBlades = [];
  for (let i = 0; i < width; i += 8) {
    grassBlades.push(new GrassBlade(i)); 
  }
}