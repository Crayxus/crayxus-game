import re

with open('D:/guandan/indexrp.html', 'r', encoding='utf-8') as f:
    content = f.read()

orig_size = len(content)

# 1. Remove all backdrop-filter
content = re.sub(r'backdrop-filter:\s*blur\([^)]*\);?', '', content)

# 2. Remove continuous CSS animations
continuous_anims = [
    'hudBreath', 'holoAvatarPulse', 'bgCoreGlow', 'iconFloat', 'holoSpin',
    'qrBreath', 'holoParticleFloat', 'holoGridPulse', 'holoTitleGlow',
    'holoTitleFloat', 'holoRingRotate', 'starTwinkle', 'holoBadgePulse',
    'hintBreath', 'hudAvatarPulse', 'badgeGlow', 'holoTablePulse',
    'aiBreath', 'jokerRainbow', 'spin', 'evoPulse'
]

for anim in continuous_anims:
    content = re.sub(r'animation:\s*' + anim + r'[^;]*;?', '', content)
    content = re.sub(r'@keyframes\s+' + anim + r'\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}', '', content)

# 3. Remove text-shadow glow
content = re.sub(r'text-shadow:\s*0\s+0\s+\d+px\s+rgba\([^)]+\)(?:\s*,\s*0\s+0\s+\d+px\s+rgba\([^)]+\))*;?', '', content)

# 4. Remove filter drop-shadow
content = re.sub(r'filter:\s*drop-shadow\([^)]*\);?', '', content)

# 5. Remove decorative HTML elements
content = re.sub(r'<div class="holo-particles"[^>]*></div>', '', content)
content = re.sub(r'<div class="holo-grid-floor"></div>', '', content)
content = re.sub(r'<div class="holo-scanline"></div>', '', content)
content = re.sub(r'<div class="holo-corner [^"]*"></div>', '', content)
content = re.sub(r'<div class="holo-table-circle"></div>', '', content)
content = re.sub(r'<div class="holo-hex-grid"></div>', '', content)

# 6. Increase bg opacity to compensate for removed blur
content = content.replace('rgba(0,0,0,0.85)', 'rgba(0,0,0,0.94)')
content = content.replace('rgba(5,5,15,0.88)', 'rgba(5,5,15,0.95)')
content = content.replace('rgba(5,5,15,0.92)', 'rgba(5,5,15,0.96)')
content = content.replace('rgba(10,10,20,0.6)', 'rgba(10,10,20,0.92)')

# 7. Title change
content = content.replace('Crayxus V41.1 - Stable', 'Crayxus V41.1 - RPi Lite')

# 8. Remove Orbitron font import (saves network request)
content = re.sub(r"@import url\('[^']*Orbitron[^']*'\);?", '', content)

# 9. Disable particle init JS
content = re.sub(r'initParticles\([^)]*\)', '/* particles disabled */', content)

# 10. Add performance CSS at top of styles
perf_css = """/* === RPi Performance Mode === */
*{-webkit-font-smoothing:auto!important}
.card,.c-mini,.grp-col .stack-card{will-change:transform}
.holo-particles,.holo-grid-floor,.holo-scanline,.holo-corner,.holo-table-circle,.holo-hex-grid{display:none!important}
"""
content = content.replace('*{margin:0;', perf_css + '*{margin:0;')

# 11. Remove complex multi-layer box-shadows (3+ layers)
content = re.sub(
    r'box-shadow:\s*0\s+0\s+\d+px\s+rgba\([^)]+\)\s*,\s*0\s+0\s+\d+px\s+rgba\([^)]+\)\s*,\s*0\s+0\s+\d+px\s+rgba\([^)]+\)(?:\s*,\s*0\s+0\s+\d+px\s+rgba\([^)]+\))*(?:\s*,\s*inset[^;]*)?;?',
    'box-shadow:0 2px 8px rgba(0,0,0,0.3);',
    content
)

with open('D:/guandan/indexrp.html', 'w', encoding='utf-8') as f:
    f.write(content)

new_size = len(content)
print(f'Original: {orig_size} bytes')
print(f'RPi Lite: {new_size} bytes')
print(f'Saved: {orig_size - new_size} bytes ({(orig_size-new_size)*100//orig_size}%)')
