const fs = require('fs');
const data = JSON.parse(fs.readFileSync('figma_data.json', 'utf8'));

let stats = {
  totalNodes: 0,
  textNodes: 0,
  colorUsages: new Set(),
  hardCodedColors: 0,
  namedColors: 0,
  fixedWidths: 0,
  autoLayouts: 0,
  smallTouchTargets: 0,
  potentialContrastIssues: 0,
  fonts: new Set(),
  gradientFills: 0,
  effects: 0 // shadows, blurs
};

function processNode(node) {
  stats.totalNodes++;
  
  if (node.type === 'TEXT') {
    stats.textNodes++;
    if (node.style && node.style.fontFamily) {
      stats.fonts.add(`${node.style.fontFamily} ${node.style.fontWeight}`);
    }
    // Check contrast roughly if we had background info, but we skip for now
  }
  
  if (node.fills && Array.isArray(node.fills)) {
    node.fills.forEach(fill => {
      if (fill.type === 'SOLID' && fill.color) {
        const hex = rgbToHex(fill.color);
        stats.colorUsages.add(hex);
        // If it has boundVariables, it's a token
        if (node.boundVariables && node.boundVariables.fills) {
          stats.namedColors++;
        } else {
          stats.hardCodedColors++;
        }
      } else if (fill.type.includes('GRADIENT')) {
        stats.gradientFills++;
      }
    });
  }
  
  if (node.effects && node.effects.length > 0) {
    stats.effects++;
  }
  
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      stats.autoLayouts++;
    } else if (node.absoluteBoundingBox) {
      // It's a fixed frame
      stats.fixedWidths++;
    }
    
    // Check touch targets for interactive elements (rough heuristic: buttons/icons)
    if (node.name && (node.name.toLowerCase().includes('button') || node.name.toLowerCase().includes('icon'))) {
      if (node.absoluteBoundingBox && (node.absoluteBoundingBox.width < 44 || node.absoluteBoundingBox.height < 44)) {
        stats.smallTouchTargets++;
      }
    }
  }

  if (node.children) {
    node.children.forEach(processNode);
  }
}

function rgbToHex(c) {
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

const page = data.nodes["0:1"].document;
processNode(page);

stats.colorUsages = Array.from(stats.colorUsages);
stats.fonts = Array.from(stats.fonts);

console.log(JSON.stringify(stats, null, 2));
