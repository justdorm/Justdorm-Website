var grid = document.querySelector('#anim-grid');
var grid2 = document.querySelector('#design-grid');
var grid3 = document.querySelector('#art-grid');
        

      var masonry3 = new Masonry(grid3, {
            itemSelector: '.grid-item',
            // percentPosition: true,
            fitWidth: true,
            columnWidth: 200,
          
        });
        var masonry2 = new Masonry(grid2, {
            itemSelector: '.grid-item',
            // percentPosition: true,
            fitWidth: true,
            columnWidth: 200,
        });
        
        var masonry = new Masonry(grid, {
            itemSelector: '.grid-item',
            // percentPosition: true,
            fitWidth: true,
            columnWidth: 200,
           
        });

    window.onload = () => {
        masonry.layout();
        masonry2.layout();
        masonry3.layout();
    }

var AboutBtn = document.getElementById("abtbtn")
 
AboutBtn.onclick = function(event){
    wait(50);
    masonry3.layout();
}
var AnimGrid = document.getElementById("anim-grid");
var DesignGrid = document.getElementById("design-grid");

var AnimBtn = document.getElementById("anim-btn");
var DesignBtn = document.getElementById("design-btn");

var animogcolor="white";
var dsgogcolor="e74d83";

AnimBtn.onclick = function(event){
    AnimBtn.style.color = "#e74d83";
    DesignBtn.style.color ="#fff";
    DesignGrid.style.display="none";
    AnimGrid.style.display="flex";
    animogcolor="#e74d83";
    dsgogcolor="white";
    masonry.layout();


};
DesignBtn.onclick = function(event){
    DesignBtn.style.color="#e74d83";
    AnimBtn.style.color="#fff";
    AnimGrid.style.display="none";
    DesignGrid.style.display="flex";
    dsgogcolor="#e74d83";
    animgogcolor="white";
    masonry2.layout();


};


AnimBtn.onmouseenter = function(event){
    animogcolor=AnimBtn.style.color;
    AnimBtn.style.color="white";
}

AnimBtn.onmouseleave = function(event){
    AnimBtn.style.color=animogcolor;
}


DesignBtn.onmouseenter = function(event){
    dsgogcolor=DesignBtn.style.color;
    DesignBtn.style.color="white";
}

DesignBtn.onmouseleave = function(event){
        DesignBtn.style.color=dsgogcolor;
}

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