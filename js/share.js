/** Share card generation. G.Share */
(function() {
    const G = window.G;

    // Real scannable QR code using qrcode-generator library
    function generateQR(text, size) {
        size = size || 140;
        const canvas = document.createElement('canvas');
        canvas.width = size * 2; canvas.height = size * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        if (typeof qrcode !== 'undefined') {
            try {
                const qr = qrcode(0, 'M');
                qr.addData(text);
                qr.make();
                const mc = qr.getModuleCount();
                const cell = size / mc;
                ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = '#000';
                for (let r = 0; r < mc; r++) for (let c = 0; c < mc; c++) {
                    if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
                }
                return canvas;
            } catch(e) {}
        }

        // Fallback decorative pattern
        const modules = 21, cellSize = size / modules;
        const matrix = Array(modules).fill(null).map(() => Array(modules).fill(false));
        function drawFinder(r,c){for(let y=0;y<7;y++)for(let x=0;x<7;x++){const border=y===0||y===6||x===0||x===6;const inner=y>=2&&y<=4&&x>=2&&x<=4;matrix[r+y][c+x]=border||inner;}}
        drawFinder(0,0);drawFinder(0,modules-7);drawFinder(modules-7,0);
        for(let i=8;i<modules-8;i++){matrix[6][i]=i%2===0;matrix[i][6]=i%2===0;}
        let hash=0; for(let i=0;i<text.length;i++) hash=((hash<<5)-hash+text.charCodeAt(i))|0;
        for(let r=9;r<modules-8;r++)for(let c=9;c<modules-8;c++){if(c===6||r===6)continue;hash=((hash<<5)-hash+r*31+c*17)|0;matrix[r][c]=(Math.abs(hash)%3)<1;}
        ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);
        ctx.fillStyle='#000';
        for(let r=0;r<modules;r++)for(let c=0;c<modules;c++)if(matrix[r][c])ctx.fillRect(c*cellSize,r*cellSize,cellSize,cellSize);
        return canvas;
    }

    function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

    function generateShareCard(stats, gameScore) {
        const W=400, H=600;
        const canvas=document.createElement('canvas'); canvas.width=W*2; canvas.height=H*2;
        const ctx=canvas.getContext('2d'); ctx.scale(2,2);

        // Dark premium gradient background
        const bg=ctx.createLinearGradient(0,0,W,H);
        bg.addColorStop(0,'#0a0a1a');
        bg.addColorStop(0.3,'#12121f');
        bg.addColorStop(0.7,'#0d0d1a');
        bg.addColorStop(1,'#080810');
        ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

        // Gold border frame
        ctx.strokeStyle='rgba(255,200,0,0.25)';
        ctx.lineWidth=2;
        roundRect(ctx,12,12,W-24,H-24,16);
        ctx.stroke();

        // Inner subtle border
        ctx.strokeStyle='rgba(255,200,0,0.08)';
        ctx.lineWidth=1;
        roundRect(ctx,18,18,W-36,H-36,12);
        ctx.stroke();

        // Header: App name
        ctx.fillStyle='#ffd700';
        ctx.font='bold 36px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign='center';
        ctx.fillText('🃏  AI 掼 蛋',W/2,60);

        ctx.font='12px sans-serif';
        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.fillText('测一测你的掼蛋水平',W/2,82);

        // Divider
        ctx.strokeStyle='rgba(255,215,0,0.15)';
        ctx.beginPath(); ctx.moveTo(40,96); ctx.lineTo(W-40,96); ctx.stroke();

        // Tier badge section
        const tier=G.Scoring.getTier(stats.elo);

        // Tier glow
        const glow=ctx.createRadialGradient(W/2,140,0,W/2,140,60);
        glow.addColorStop(0,tier.color+'30');
        glow.addColorStop(1,'transparent');
        ctx.fillStyle=glow;
        ctx.beginPath(); ctx.arc(W/2,140,60,0,Math.PI*2); ctx.fill();

        // Tier icon
        ctx.font='52px sans-serif';
        ctx.textAlign='center';
        ctx.fillText(tier.icon,W/2,160);

        // Tier name
        ctx.fillStyle=tier.color;
        ctx.font='bold 24px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText(tier.name,W/2,195);

        // ELO score
        ctx.fillStyle='#fff';
        ctx.font='bold 36px sans-serif';
        ctx.fillText('ELO  ' + stats.elo.toLocaleString(),W/2,235);

        // Divider
        ctx.strokeStyle='rgba(255,215,0,0.15)';
        ctx.beginPath(); ctx.moveTo(40,255); ctx.lineTo(W-40,255); ctx.stroke();

        // Stats grid
        const gridY=285;
        const gridData=[
            {l:'总场次',v:stats.totalGames+''},
            {l:'胜率',v:G.Scoring.getWinRate(stats)+'%'},
            {l:'最高连胜',v:stats.maxWinStreak+''}
        ];
        const colW=(W-80)/3;
        ctx.textAlign='center';
        gridData.forEach((item,i)=>{
            const x=40+colW*i+colW/2;
            ctx.fillStyle='#ffd700';
            ctx.font='bold 26px sans-serif';
            ctx.fillText(item.v,x,gridY);
            ctx.fillStyle='rgba(255,255,255,0.45)';
            ctx.font='12px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText(item.l,x,gridY+20);
        });

        // Divider
        ctx.strokeStyle='rgba(255,215,0,0.15)';
        ctx.beginPath(); ctx.moveTo(40,gridY+36); ctx.lineTo(W-40,gridY+36); ctx.stroke();

        // National ranking
        const rankY=gridY+62;
        const ranking=G.Scoring.estimatePercentile(stats.elo,'national');
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.font='13px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign='center';
        ctx.fillText('全国排名',W/2,rankY);

        ctx.fillStyle='#ffd700';
        ctx.font='bold 32px sans-serif';
        ctx.fillText('#'+ranking.rank.toLocaleString(),W/2,rankY+38);

        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.font='12px sans-serif';
        ctx.fillText('超越 '+ranking.percentile+'% 的玩家',W/2,rankY+58);

        // Game result bar
        if (gameScore) {
            const gsY=rankY+80;
            ctx.fillStyle='rgba(255,215,0,0.08)';
            roundRect(ctx,36,gsY,W-72,40,10);
            ctx.fill();
            ctx.strokeStyle='rgba(255,215,0,0.15)';
            roundRect(ctx,36,gsY,W-72,40,10);
            ctx.stroke();

            ctx.fillStyle='#ffd700';
            ctx.font='bold 15px "PingFang SC","Microsoft YaHei",sans-serif';
            ctx.textAlign='center';
            const deltaStr = (gameScore.eloDelta >= 0 ? '+' : '') + gameScore.eloDelta;
            ctx.fillText('本局: '+gameScore.positionLabel+' | '+deltaStr+' ELO',W/2,gsY+26);
        }

        // QR code section
        const qrSize=100;
        const qrY=H-160;
        const rawUrl = window.location.href.split('?')[0];
        const appUrl = (rawUrl.startsWith('file://') || rawUrl.includes('localhost') || rawUrl.includes('127.0.0.1'))
            ? 'https://aiguandan.au'
            : rawUrl;
        const qrCanvas=generateQR(appUrl,qrSize*2);

        // QR background
        ctx.fillStyle='rgba(255,255,255,0.03)';
        roundRect(ctx,30,qrY-16,W-60,140,12);
        ctx.fill();

        // QR code - left aligned
        const qrX=56;
        ctx.drawImage(qrCanvas,qrX,qrY,qrSize,qrSize);

        // QR text - right side
        ctx.fillStyle='rgba(255,255,255,0.7)';
        ctx.font='bold 14px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign='left';
        ctx.fillText('扫码测试你的掼蛋水平',qrX+qrSize+20,qrY+35);

        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.font='12px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText('你能超越多少人？',qrX+qrSize+20,qrY+58);

        ctx.fillStyle='rgba(0,255,204,0.5)';
        ctx.font='11px sans-serif';
        ctx.fillText('纯前端AI · 即开即玩',qrX+qrSize+20,qrY+80);

        canvas.style.width=W+'px'; canvas.style.height=H+'px';
        return canvas;
    }

    function saveCanvasAsImage(canvas){const a=document.createElement('a');a.download='AI掼蛋战绩.png';a.href=canvas.toDataURL('image/png');a.click();}

    async function shareCard(canvas){
        try{canvas.toBlob(async(blob)=>{
            if(navigator.share&&navigator.canShare){const f=new File([blob],'guandan_ai.png',{type:'image/png'});const sd={title:'AI掼蛋战绩',text:'来和我一起玩AI掼蛋吧！',files:[f]};if(navigator.canShare(sd)){await navigator.share(sd);return;}}
            saveCanvasAsImage(canvas);
        },'image/png');}catch(e){saveCanvasAsImage(canvas);}
    }

    G.Share = {generateShareCard,saveCanvasAsImage,shareCard};
})();
