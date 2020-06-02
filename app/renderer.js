// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const electron = require('electron')
const {ipcRenderer} = electron
const {dialog} = electron.remote
const {shell} = require('electron')

const url = require('url')
const path = require('path')

require("./lib/minicolors/jquery.minicolors.js");

global.jQuery = global.$ = require('jquery');
global.angular = require('angular');

var app = angular.module('giftuna',[]);
app.controller('installFfmpeg',function($scope){


  $scope.ffmpeg_click = function(){
    shell.openExternal("http://ffmpeg.org");
  }
  $scope.quit = function(){
    electron.remote.app.quit();
  }
  $scope.install = function(){
    $scope.installing=true;
    ipcRenderer.send('install_ffmpeg', {});
  }
  ipcRenderer.on('ffmpeg_installed',function(ev,data){
    console.log('ffmpeg_installed');
    // window.location.href = "/index.html";
    $scope.installing=false;
    $scope.$apply();
  });
  //open links externally by default
  // $('a[href^="http"]').on('click',function(event) {
  //   console.log("A");
  //   event.preventDefault();
  //   shell.openExternal(this.href);
  // });

});
app.controller('gifSettings',function($scope,$filter,$timeout,$rootScope){
  $scope.status = {
    state:0,
    export:{progress:0,size:0,path:null}
  }
  $scope.frames = {
    current:0,
    min:0,
    max:100
  }
  $scope.defaults = {
    file: {
      input:null
    },
    dimensions: {
      original_width:320,
      original_height:240,
      width:320,
      height:240,
      lock:true
    },
    croptime:{
      start_time: 0,
      end_time:0
    },
    fps:24,
    color: {
      stats_mode:"diff",
      diff_mode: "rectangle",
      dither:true,
      count: 256,
      dither_scale:3,
      alpha:false
    }
  };
  $scope.settings = angular.copy($scope.defaults);
  $scope.color_value = 256;

  $scope.$watch('color_value',function(nv){
    if(nv){
      $scope.settings.color.count = Number(nv);
    }
  });
  $scope.$watch('settings.color.count',function(nv){
    if(nv){
      $scope.color_value = Number(nv);
    }
  })

  $scope.settings.dimensions.ratio = $scope.settings.dimensions.original_height/$scope.settings.dimensions.original_width;
  var prom;
  $scope.$watch('frames.current',function(nv,ov){
    if(nv!=ov && $scope.status.state==5){
      $scope.refreshThumbnail();
    }
  });
  $rootScope.$on('colorPaletteChange',function(){
    $scope.refreshThumbnail();
  });

  $scope.reveal = function(){
    console.log($scope.status.export.path);
    shell.showItemInFolder($scope.status.export.path);
  }
  $scope.preview = function(){
    window.open(url.format({
      pathname: $scope.status.export.path,
      protocol: 'file:',
      slashes: true
    }));
  }
  $scope.set_start = function(){
    $scope.settings.croptime.start_time = $scope.frames.current;
  }
  $scope.set_end = function(){
    $scope.settings.croptime.end_time = $scope.frames.current;
  }
  $scope.export = function(){
    var base = path.parse($scope.settings.file.input.path);
    var output = path.join(base.dir, base.name+'.gif');
    dialog.showSaveDialog({title:"Export GIF", defaultPath: output, buttonLabel:"Export"}, function(outputFile){
      console.log(outputFile);
      if(outputFile){
        $scope.status.export = {progress:0, size:0, path:outputFile};
        $scope.status.state = 4;

        $scope.$apply();
        ipcRenderer.send('exportGif', $scope.settings.file.input.path, outputFile, $scope.palette, $scope.settings);
      }
      // $rootScope.exportStatus.filepath = file;
      // $rootScope.exportStatus.filename = path.basename(file);
      // $rootScope.exportStatus.status = 1;
      // $rootScope.exportStatus.totalFrames = Math.floor($rootScope.currentSource.stream.duration * $rootScope.prefs.fps);
      // ipcRenderer.send('exportGif', $rootScope.currentSource.source.file.path, file, $rootScope.colorPalette, $rootScope.prefs);
    });
  }
  $scope.cancelExport = function(){
    $scope.status.export.canceling=true;
    ipcRenderer.send('cancel_export', {remove:$scope.status.export.path});

  }
  $scope.widthChange = function(){
    if($scope.settings.dimensions.width > 0 && $scope.settings.dimensions.lock){
      var ratio = $scope.settings.dimensions.original_height/$scope.settings.dimensions.original_width;
      $scope.settings.dimensions.height = Math.round($scope.settings.dimensions.width*ratio);
    }
    // if(prom) $timeout.cancel(prom);
    // prom = $timeout(function(){
    //   $scope.refreshThumbnail();
    // },2000);
  }
  $scope.heightChange = function(){
    if($scope.settings.dimensions.height > 0 && $scope.settings.dimensions.lock){
      var ratio = $scope.settings.dimensions.original_width/$scope.settings.dimensions.original_height;
      $scope.settings.dimensions.width = Math.round($scope.settings.dimensions.height*ratio);
    }

  }

  $scope.cancel = function(reset){
    ipcRenderer.send('cancelProcess', {});
    if(reset){
      $scope.status.state=0;
      $scope.settings.file = {input:null};
      $scope.palette = null;
      $scope.thumbnail = null;
    }
  }
  $scope.refreshFps = function(){
    if($scope.stored.fps != $scope.settings.fps){
      //$scope.frames.max = Math.floor($scope.settings.probe.duration * $scope.settings.fps);
      // if($scope.frames.current > $scope.frames.max){
      //   $scope.frames.current = $scope.frames.max;
      // }
      $scope.refreshThumbnail();
    }
  }
  $scope.refreshDimension = function(key){

    if($scope.stored.dimensions[key] != $scope.settings.dimensions[key]){
      console.log('diff');
      // if(prom) $timeout.cancel(prom);
      // prom = $timeout(function(){
        $scope.refreshThumbnail();
      // },2000);
    }
  }
  $scope.exportDone = function(){
    $scope.status.state=5;
    $scope.status.export = {progress:0, size:0, path:null};
  }
  $scope.refreshPalette = function(){
    $scope.thumbnail = null;
    $scope.palette = null;
    $scope.cancel();

    $scope.status.state=2;
    ipcRenderer.send('getPalette', $scope.settings.file.input.path, $scope.settings)
  }
  $scope.refreshThumbnail = function(){
    $scope.thumbnail = null;
    $scope.status.state=3;
    var time = $scope.frames.current;
    ipcRenderer.send('getThumbnail', $scope.settings.file.input.path, $scope.palette, time, $scope.settings)
  }
  ipcRenderer.on('export_canceled',function(ev,progress){
    console.log("CANCELED");
    $scope.status.export.canceling=false;
    $scope.exportDone();
    $scope.$apply();
  });
  ipcRenderer.on('export_progress',function(ev,progress){
    console.log("Progress", progress);
    var p = (progress.sec/$scope.settings.probe.duration)*100;
    $scope.status.export.progress = p;
    $scope.status.export.size = progress.size;
    $scope.$apply();
  });
  ipcRenderer.on('export_finished',function(ev,finalsize){
    console.log("DONE!");
    $scope.status.export.progress = 100;
    $scope.status.export.size = finalsize;
    // $scope.status.state = 5;
    $scope.$apply();
  });


  ipcRenderer.on('probeResult', (event, probe) => {
    console.log(probe);
    var videoStream = probe.streams.find(function(it){return it.codec_type=='video'; });
    if(!videoStream){
      console.error("No video stream found");
      return;
    }

    ;

    $scope.frames.max = (Math.floor(videoStream.duration * 10) / 10).toFixed(1) - 0.1; //videoStream ? Math.floor(videoStream.duration * $scope.settings.fps) : 0;
    $scope.settings.probe = {duration:videoStream.duration, rate:(videoStream.r_frame_rate||videoStream.avg_frame_rate)}
    $scope.settings.dimensions.width = videoStream.width;
    $scope.settings.dimensions.height = videoStream.height;
    $scope.settings.dimensions.original_width = videoStream.width;
    $scope.settings.dimensions.original_height = videoStream.height;
    $scope.settings.dimensions.ratio = videoStream.width/videoStream.height;

    $scope.settings.fps = parseInt($filter('framerate')((videoStream.r_frame_rate||videoStream.avg_frame_rate), true));

    //get thumbnail
    $scope.refreshPalette();
    // $scope.status.state=2;
    // ipcRenderer.send('getPalette', $scope.settings.file.input.path, $scope.settings)
    $scope.$apply();
  });
  ipcRenderer.on('paletteResult', (event, paletteResult) => {
    if($scope.status.state==2){
      $scope.palette = paletteResult;
      $scope.status.state=3;
      var time = $scope.frames.current;
      ipcRenderer.send('getThumbnail', $scope.settings.file.input.path, $scope.palette, time, $scope.settings)
      $scope.$apply();
    }
  });
  ipcRenderer.on('thumbnailResult', (event, thumbnailResult) => {
    $scope.thumbnail = 'data:image/gif;base64,'+thumbnailResult;
    $scope.status.state=5;
    $scope.stored = angular.copy($scope.settings);
    $scope.$apply();
  });

  $scope.$watch('settings.file.input',function(nv){
    //reset file input
    if(nv){
      $scope.frames.current=0;
      $scope.status.state=1;
      $scope.palette = null;
      $scope.thumbnail = null;
      $scope.settings.color = angular.copy($scope.defaults.color);
      ipcRenderer.send('probeInput', nv.path)
    }
  });
});

app.filter('filesize',function(){
  return function(size){
    var i = Math.floor( Math.log(size) / Math.log(1000) );
    return size > 0 ? ( size / Math.pow(1000, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i] : '-';
  }
})

app.filter('framerate', function(){
  return function(input, suffix){
    if(!input){
      return '-';
    }
    var fr = input.split('/');
    var r = (parseInt(fr[0])/parseInt(fr[1]));
    if(suffix){
      return r+' fps';
    }
    return r;
    //scope.frames = Math.ceil(nv*rate);
  }
})
.filter('ratio', function(){
  return function(x){

    var tolerance = 1.0E-6;
    var h1=1; var h2=0;
    var k1=0; var k2=1;
    var b = x;
    do {
        var a = Math.floor(b);
        var aux = h1; h1 = a*h1+h2; h2 = aux;
        aux = k1; k1 = a*k1+k2; k2 = aux;
        b = 1/(b-a);
    } while (Math.abs(x-h1/k1) > x*tolerance);

    return h1+":"+k1;

  }
})

app.directive('inputSelect',function(){
  return {
    require:'ngModel',
    link: function(scope,ele,attr,ngModelCtl){
      var $file = $("<input type=\"file\" />");
      $file.on('change',function(e){
        var file = $(this).get(0).files[0];
        console.log(file);
        ngModelCtl.$setViewValue(file);
        ngModelCtl.$render();
        $(this).val('');
      });

      ele.on('click',function(e){
        console.log('click');
        $file.trigger('click');
      });
    }
  }
})
app.directive('pixelPalette', function($timeout,$rootScope){
return {
  // template:'<img class="palette" ng-if="palette_data!=null" ng-src="data:image/png;base64,{{palette_data}}" />',
  templateUrl: 'tpl/palette.html',
  require: 'ngModel',
  scope: {
    ngModel:'=',
    maxColors:'='
  },
  link: function(scope,ele,attr,ngModelCtl){

      scope.pixels = scope.ngModel ? read_palette(scope.ngModel) : [];
      scope.rgb = {};

      scope.$watch('ngModel',function(nv,ov){
        if(nv && nv!=ov){
          scope.pixels = read_palette(nv);
        }
        if(nv==null){
          scope.pixels = [];
        }
      })

      // scope.hexPattern = new RegExp(/^0x[0-9A-F]{1,4}$/i);
      ele.find('.hex-input').on('keyup',function(e){
        var regExp = new RegExp(/[0-9A-F]/i);
        var last = $(this).val().substr(-1)
        console.log(last);
        if(!regExp.test(last)){
          console.log("NOPE");
          $(this).val($(this).val().slice(0,-1));
        }
      });

      $picker = ele.find('.pixel-picker');
      $mini  = ele.find('input.pixel-mini-colors');

      $mini.minicolors({
        inline:true,
        format:'rgb',
        change: function(value, opacity) {
          var rgb = $(this).minicolors('rgbObject');
          $timeout(function() {
            // scope.pixels[scope.pixelIndex] = [rgb.r,rgb.g,rgb.b];
            scope.rgb = rgb;
            scope.hexValue = rgb_to_hex(scope.rgb.r,scope.rgb.g,scope.rgb.b);
          });
        }
      });

      $picker.appendTo(document.body);
      $picker.on('click',function(e){
        // e.preventDefault();
        e.stopPropagation();
      }).on('mousedown',function(){
        scope.startedIn=true;
      });
      scope.$close = function(){
        $picker.removeClass('open');
        scope.pixelIndex = null;
        scope.rgb = {};
      }
      scope.$set = function(){
        $picker.removeClass('open');
        scope.pixels[scope.pixelIndex] = [scope.rgb.r,scope.rgb.g,scope.rgb.b];
        scope.pixelIndex = null;
        put_palette();
        scope.rgb = {};

      }
      scope.pickMe = function(i,e){
        e.preventDefault();
        e.stopPropagation();

        var p = $(e.target).offset();
        var color = scope.pixels[i];
        $mini.minicolors('value', "rgb("+color.join(',')+")");
        scope.stored = color;
        scope.pixelIndex = i;
        scope.hexValue = rgb_to_hex(color[0],color[1],color[2]);


        $picker.css('top',p.top+'px').css('left',p.left+'px').addClass('open');
      }
      $(document).on('mouseup',function(e){
        if(!scope.startedIn){
          $picker.removeClass('open');
          scope.pixelIndex = null;
        }
        scope.startedIn=false;
      });
      scope.$color = function(c){
        return {
          'background-color': "rgb("+c[0]+","+c[1]+","+c[2]+")"
        }
      }

      function put_palette(){
        if(scope.pixels.length>0){
          var canvas_copy = document.createElement('canvas');
          var ctx_copy = canvas_copy.getContext('2d');

          var idata = ctx_copy.getImageData(0,0,16,16);
          for(var i=0;i<idata.data.length;i+=4){
            var pixel = Math.floor(i/4);
            idata.data[i] = scope.pixels[pixel] ? scope.pixels[pixel][0] : 0;
            idata.data[i+1] = scope.pixels[pixel] ? scope.pixels[pixel][1] : 0;
            idata.data[i+2] = scope.pixels[pixel] ? scope.pixels[pixel][2] : 0;
            idata.data[i+3] = 255;
          }
          // for(var i=0;i<scope.pixels.length;i++){
          //   data[i] = scope.pixels[i][0] || 0;
          //   data[i+1] = scope.pixels[i][1] || 0;
          //   data[i+2] = scope.pixels[i][2] || 0;
          //   data[i+3] = 255;
          // }
          // console.log(data);
          ctx.putImageData(idata,0,0);
          var uri = canvas.toDataURL("image/png").split('base64,')[1];
          // $scope.palette = uri;
          ngModelCtl.$setViewValue(uri);
          ngModelCtl.$render();
          $rootScope.$emit('colorPaletteChange');
        }
      }
      function rgb_to_hex(r,g,b){
          var bin = r << 16 | g << 8 | b;
          return (function(h){
              return new Array(7-h.length).join("0")+h
          })(bin.toString(16).toUpperCase())
      }
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');

      function read_palette(img_src){
        var img = new Image();
        img.src = 'data:image/png;base64,'+img_src;
        canvas.width = 16;
        canvas.height = 16;
        ctx.clearRect(0,0,16,16);
        ctx.drawImage(img,0,0);
        // scope.pixels = [];
        var pixel_array = [];
        var pixel_data = ctx.getImageData(0,0,16,16);
        for(var i=0;i<pixel_data.data.length;i+=4){
          var p = [];
          p[0] = pixel_data.data[i];
          p[1] = pixel_data.data[i+1];
          p[2] = pixel_data.data[i+2];
          p[3] = 255;
          if(pixel_array.length < scope.maxColors)
            pixel_array.push(p);
        }
        return pixel_array;
        // scope.pixels.push([0,0,0,0]);
        // ngModelCtl.$setViewValue(canvas.toDataURL("image/png").split('base64,')[1]);
        // ngModelCtl.$render();

        // for(var x=0;x<16;x++){
        //   for(var y=0;y<16;y++){
        //     pixels.push(ctx.getImageData(x,y,1,1))
        //   }
        // }

      }
    }
  }
})


app.directive('frameScrubber',function(){
  return {
    scope: {
      ngModel:'=',
      frames:'=',
      disabled:'='
    },
    template: '<div class="scrubber-frame">{{params.value}}s</div><div class="scrubber-bar"><input ng-disabled="disabled" type="range" step="0.1" ng-model="params.value" min="0" /></div><div class="scrubber-frame">{{params.max+0.1}}s</div>',
    require: 'ngModel',
    link: function(scope,ele,attr,ngModelCtl){
      scope.params = {value:0};
      var $input = $(ele).find('input');
      scope.$watch('ngModel',function(nv,ov){
        if(nv!=ov){
          scope.params.value = nv;
        }
      });
      scope.$watch('frames',function(nv){
        console.log('frame change', nv);
        if(nv){
          scope.params.max = nv;
          $input.attr('max',nv);
        }
      });
      $input.on('change',function(e){
        console.log('change!');
        ngModelCtl.$setViewValue(scope.params.value);
        ngModelCtl.$render();
      });
    }
  }
})
app.directive('gifPreview',function(){
  return {
    // template: '<div class="preview-div" ng-style="$previewStyle()"></div>',
    template: '<img src="" />',
    link: function(scope,ele,attr){
      scope.preview_scale = 1;
      // $(ele).on('resize',function(e){
        console.log($(ele).find('.preview-wrap').width());
        // var aspect = scope.settings.dimensions.height/scope.settings.dimensions.width;
      // });
      scope.$previewStyle = function(){

        return {
          'background-image':'url('+scope.thumbnail+')',
          'max-width':scope.settings.dimensions.width+'px',
          'max-height':scope.settings.dimensions.height+'px'
          // 'height': (scope.settings.dimensions.height/scope.settings.dimensions.width)*100 + 'vw'
        };

        // console.log($(ele).width());
        // if($(ele).width() < scope.settings.dimensions.width || $(ele).height() < scope.settings.dimensions.height){
        //   return {
        //     'width':'100%',
        //     'max-width':scope.settings.dimensions.width+'px',
        //     'max-height':scope.settings.dimensions.height+'px',
        //     'padding-bottom': (scope.settings.dimensions.height/scope.settings.dimensions.width)*100 + '%'
        //   }
        // }else{
        //   return {
        //     'max-width':scope.settings.dimensions.width+'px',
        //     'max-height':scope.settings.dimensions.height+'px',
        //     'padding-bottom': (scope.settings.dimensions.height/scope.settings.dimensions.width)*100 + '%'
        //     // 'height':scope.settings.dimensions.height+'px'
        //   }
        // }

      }
    }
  }
})
