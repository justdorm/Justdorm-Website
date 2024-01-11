var grid3 = document.querySelector('#art-grid');
        

      var masonry = new Masonry(grid3, {
            itemSelector: '.grid-item',
            // percentPosition: true,
            fitWidth: true,
            columnWidth: 200,
          
        });
       
    window.onload = () => {
        masonry.layout();
    }

var AnimMenu = document.getElementById("animMenu");
var DesignMenu = document.getElementById("designMenu");

AnimMenu.onclick = function(event){
    AnimBtn.style.color = "#e74d83";
    DesignBtn.style.color ="#fff";
    DesignGrid.style.display="none";
    AnimGrid.style.display="flex";
    animogcolor="#e74d83";
    dsgogcolor="white";
    masonry.layout();


};

DesignMenu.onclick = function(event){
    DesignBtn.style.color="#e74d83";
    AnimBtn.style.color="#fff";
    AnimGrid.style.display="none";
    DesignGrid.style.display="flex";
    dsgogcolor="#e74d83";
    animgogcolor="white";
    masonry2.layout();
};

const canvas = document.querySelector('canvas'),
				 ctx = canvas.getContext('2d')

canvas.width = canvas.height = 128

resize();
window.onresize = resize;

function resize() {
	canvas.width = window.innerWidth * window.devicePixelRatio
	canvas.height = window.innerHeight * window.devicePixelRatio
	canvas.style.width = window.innerWidth + 'px'
	canvas.style.height = window.innerHeight + 'px'
}

function noise(ctx) {
    
	const w = ctx.canvas.width,
				h = ctx.canvas.height,
				iData = ctx.createImageData(w, h),
				buffer32 = new Uint32Array(iData.data.buffer),
				len = buffer32.length
	  let i = 0

	for(; i < len;i++)
		
		if (Math.random() < 0.5) buffer32[i] = 0xffffffff;

		ctx.putImageData(iData, 0, 0);
}

(function loop() {
    noise(ctx);
    requestAnimationFrame(loop);
})();