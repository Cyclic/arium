'use strict';

var _ = require('underscore');
var gulp = require('gulp');
var path = require('path');

var $ = require('./src/gulp'); // Gulp helper object

// Tasks

gulp.task('clean', function() {
  return gulp.src(".tmp", {read: false}).pipe($.clean());
});

gulp.task('mkdirs', $.mkdirs($.config.get("create_dirs")));


gulp.task('prepare',function(cb) {
  $.sequence('clean', 'mkdirs', cb);
});

gulp.task('default', ['prepare'], function(cb) {
  //$.util.log("mogg2wav, running with config: " + JSON.stringify($.config, null, 2));
  require('./src/gulpfile');

  $.sequence(
    'library',
    cb);
});

gulp.task("app-templates", function() {

  var jadeVars = {
    "NG": true,
    config: $.config,
    baseUrl: $.config.get('routes.app')
  };

  return gulp.src("{views,components}/**/*.jade", { cwd: "src/web/app"})
   // .pipe(jadeFilter)
   // .pipe($.jsmacro($.options.jsmacro.client)) // unlike html, jade will be processed with jsmacro
   .pipe($.debug({ verbose: true }))

    .pipe($.jade({ pretty: true, locals: jadeVars }))
    .pipe($.debug({ verbose: true }))
    //.pipe(jadeFilter.restore())
    .pipe($.ngHtml2js({
        moduleName: "app-templates",
       // declareModule: false,
        rename: function(filename) {
           return filename.replace('.html', '.jade');
        }
      //  stripPrefix: config.cwd
    }))
    .pipe($.concatUtil('templates.js'))
    .pipe($.rename({
      dirname: "web/app",
      basename: "templates"
    }))
    .pipe($.debug({ verbose: true }))

   // .pipe($.concat(config.module + '.js'))
    .pipe(gulp.dest(".tmp"))
    .pipe($.size({ showFiles: true }));

});

gulp.task("daw-templates", function() {

  var jadeVars = {
    "NG": true,
    config: $.config,
    baseUrl: $.config.get('routes.app')
  };

  return gulp.src("{views,components}/**/*.jade", { cwd: "src/web/daw"})
   // .pipe(jadeFilter)
   // .pipe($.jsmacro($.options.jsmacro.client)) // unlike html, jade will be processed with jsmacro
   .pipe($.debug({ verbose: true }))

    .pipe($.jade({ pretty: true, locals: jadeVars }))
    .pipe($.debug({ verbose: true }))
    //.pipe(jadeFilter.restore())
    .pipe($.ngHtml2js({
        moduleName: "daw-templates",
       // declareModule: false,
        rename: function(filename) {
           return filename.replace('.html', '.jade');
        }
      //  stripPrefix: config.cwd
    }))
    .pipe($.concatUtil('templates.js'))
    .pipe($.rename({
      dirname: "web/daw",
      basename: "templates"
    }))
    .pipe($.debug({ verbose: true }))

   // .pipe($.concat(config.module + '.js'))
    .pipe(gulp.dest(".tmp"))
    .pipe($.size({ showFiles: true }));

});


gulp.task('coffee', function() {

  var srcRoot = $.config.get('paths.web');
  $.util.log("Starting coffee, source root: " + srcRoot);
  return gulp.src('src/{lib,server,web}/**/*.coffee')
    .pipe($.changed('.tmp', { 
      extension: ".js",
      hasChanged: $.needBuild
    }))
    .pipe($.sourcemaps.init())
      .pipe($.coffee({ bare: true }).on('error', $.util.log))
    .pipe($.sourcemaps.write({ sourceRoot: "./" }))
    .pipe(gulp.dest('.tmp'));

});

gulp.task('less', function() {

  return gulp.src('src/web/**/*.less')
    .pipe($.changed('.tmp', { 
      extension: ".css",
      hasChanged: $.needBuild
    }))
    .pipe($.debug({ verbose: true }))
    .pipe($.sourcemaps.init())
      .pipe($.less({
        paths: path.join(__dirname, 'src/web/app/styles'),
        sourceMapBasepath: path.join(__dirname, 'web')
      }).on('error', $.util.log))
    .pipe($.sourcemaps.write({ sourceRoot: '/' }))
    .pipe(gulp.dest('.tmp/web'));

});


var lrServer;
function livereload() {
  if (!lrServer) {
    var lrPort = $.config.get("ports.livereload");
    $.util.log("Starting livereload server on port: " + lrPort);
    lrServer = $.livereload(lrPort);
  }
  return lrServer;
}


gulp.task('watch', function(cb) {

  gulp.watch('src/{lib,server,web}/**/*.coffee', { mode: 'poll'}, ['coffee']);
  gulp.watch("src/web/app/**/*.jade", { mode: 'poll'}, ["app-templates"]); // recompile jade templates to JS on file save
  gulp.watch("src/web/daw/**/*.jade", { mode: 'poll'}, ["daw-templates"]); 
  gulp.watch('src/web/**/*.less', { mode: 'poll'}, ['less']);

  var lr = livereload();
  gulp.watch([
      "src/{web,.tmp,lib,static}/**/*",
      "!**/*.{jade,coffee,less}"
    ], { 
      // glob: , 
      // emitOnGlob: false, 
      // emit: "all",
     // mode: 'poll'
    }, function(event) {
      $.util.log('WATCH CHANGE: ' + event.type + ' ' + event.path);
      lr.changed(event.path);
    });

    //.pipe(lr);
});

gulp.task('build', function(cb) {
  runSequence('clean', cb);
});

gulp.task('server', ['clean'], function(cb) {
  // start LR server
  livereload();
  console.log("$: " + JSON.stringify($));
  $.sequence('app-templates', 'daw-templates', 'coffee', 'less', function() {
    $.util.log("Now starting server and watch");
    $.gulp.start('dev-server', 'watch', function() {
      $.util.log("Somehow it is all over?");
    })

  });
});

gulp.task('server:dist', ['build'], function(cb) {
  $.sequence('dist-server');
})

var serverArgs = function(dist) {
  // Build command line args for express server
  var args = [];
  args.push("--port=8008");
  if ($.args['server-url']) {
    args.push("--server-url=" + $.args['server-url']);
  }

  if (dist) {
    //args.push("--config-file=../src/config.json");
  }
  return args;
};

gulp.task('dev-server', function(cb) {
  var lr = livereload();
  var args = serverArgs(false);
  var file = $.path.resolve('./src/server.js');

  var env = $.merge(process.env, {
    NODE_ENV: 'development',
  //  NODE_DEBUG: "livereload,express:*",
   // DEBUG: "tinylr:*,send"
  });

  $.util.log("Server env: " + JSON.stringify(env, null, 2));

  var server = $.server(file, {
    args: args,
    env: env
  });

  server.on('server.started', function() {
    $.util.log("Received SERVER STARTED event.");
  });

  server.start();

  $.watch({
    glob: ['.tmp/_livereload'],
    emitOnGlob: false
  }, function(stream) {
    $.util.log("Sending LIVERELOAD event to all clients");
   // setTimeout(function() {
      //for (var i = 0; i < lrServers.length; i++) {
        lr.changed("/");
      //}
    //}, 2000);
  });

  $.watch({
    glob: [
      file,
      'src/config/*.json',
      'src/server/**/*'
    ],
    timeout: 1000,
    emitOnGlob: false,
 //   passThrough: false
  }, function(stream) {
    $.util.log("Server files changed, server will restart");
    //return stream;
  })
  .pipe(server);

});


gulp.task('dist-server', function(cb) {
  var args = serverArgs(true);
  var file = options.serverFile.dist;

  $.util.log("Starting dist server: " + file + " : " + JSON.stringify(args));

  gulp.src(file)
    .pipe($.server(file, {
      args: args
    }));
});






