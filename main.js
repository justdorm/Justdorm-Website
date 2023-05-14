var grid = document.querySelector('#anim-grid');
        var grid2 = document.querySelector('#design-grid');
        
        var masonry2 = new Masonry(grid2, {
            itemSelector: '.grid-item',
            // percentPosition: true,
            fitWidth: true,
            columnWidth: 200,
            gutter: 5
        });
        
        var masonry = new Masonry(grid, {
            itemSelector: '.grid-item',
            // percentPosition: true,
            fitWidth: true,
            columnWidth: 200,
            gutter: 5
        });

    window.onload = () => {
        masonry.layout();
        masonry2.layout();
    }
 

    // var grid2 = document.querySelector('#design-grid');
    
    // var masonry2 = new Masonry(grid2, {
    //     itemSelector: '.grid-item2',
    // });


var AnimGrid = document.getElementById("anim-grid");
var DesignGrid = document.getElementById("design-grid");

var AnimBtn = document.getElementById("anim-btn");
var DesignBtn = document.getElementById("design-btn");

var animogcolor;
var dsgogcolor;

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
    console.log(animogcolor);
    animogcolor=AnimBtn.style.color;
    AnimBtn.style.color="white";
}

AnimBtn.onmouseleave = function(event){
    console.log(animogcolor);
    if (animogcolor){
        AnimBtn.style.color=animogcolor;
    }
}


DesignBtn.onmouseenter = function(event){
    dsgogcolor=DesignBtn.style.color;
    DesignBtn.style.color="white";
}

DesignBtn.onmouseleave = function(event){
    if (dsgogcolor){
        DesignBtn.style.color=dsgogcolor;
    }
}

