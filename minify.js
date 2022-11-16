// minify.js
var Terser = require("terser");
//To use esbuild: npm install esbuild and comment out line below, and comment out Terser line above
var esbuild;
try {
    esbuild = require('esbuild');
}
catch (e) { }
var fs = require("fs");
var path = require("path");


function getAllFiles(dirPath, outPath, arrayOfFiles) {
    let files = fs.readdirSync(dirPath);
    outPath = outPath || dirPath;
    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function (file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, outPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push([path.join(__dirname, dirPath, "/", file), path.join(__dirname, outPath, "/", path.parse(file).name + '.js')]);
        }
    });

    return arrayOfFiles.filter(path => path[0].match(/\.(js|ts)$/));
}

async function minifyFiles(filePaths, verbose, config) {
    let t = Date.now();
    let min = process.argv.indexOf('-m') !== -1 || process.argv.indexOf('-miniify') !== -1 || process.argv.indexOf('--miniify') !== -1;
    config = config || './tsconfig.json'
    await Promise.all(filePaths.map(async (filePath) => {
        if (verbose)
            console.log(`${filePath[0]} -> ${filePath[1]}`);
        if (process.argv.indexOf('-es') !== -1 || process.argv.indexOf('-esbuild') !== -1) {
            if (!esbuild) return;
            esbuild.buildSync({
                entryPoints: [filePath[0]],
                bundle: false,
                outfile: filePath[1],
                loader: { ".ts": "ts" },
                minify: min,
                tsconfig: config,
                target: "es2020",
                format: "cjs"
            });
        }
        else
            fs.writeFileSync(
                filePath[1],
                (await Terser.minify(fs.readFileSync(filePath[0], "utf8"), {
                    ecma: 2017,
                    format: {
                        comments: false,
                        ecma: 2017
                    }
                })).code
            );
        //To use esbuild uncomment block below and comment out fs.write block above
        /*
         fs.writeFileSync(
             filePath[1],
             (esbuild.transformSync(fs.readFileSync(filePath[0], "utf8"), {
                 minify: min,
                 target: 'es2017',
                 format: "cjs"
             })).code
         );
         */
    }));
    console.log(`Completed in ${(Date.now() - t) / 1000} seconds`);
}
let files;
if (process.argv.indexOf('-es') !== -1 || process.argv.indexOf('-esbuild') !== -1) {
    if (!esbuild) {
        console.log('esbuild not installed');
        return;
    }
    files = getAllFiles("./src/common", './build/js');
    files.push(...getAllFiles("./src/worker", './build/js'));
}
else
    files = getAllFiles("./out", './build/js');
minifyFiles(files, process.argv.indexOf('-v') !== -1 || process.argv.indexOf('-verbose') !== -1 || process.argv.indexOf('--verbose') !== -1, './src/worker/tsconfig.json').then(r => r);