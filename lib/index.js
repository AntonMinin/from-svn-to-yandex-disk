'use strict';

var SvnClient = require('svn-spawn'),
    fs = require('fs'),
    Promise = require('promise'),
    path = require("path"),
    request = require('request'),
    rmdir = require('rmdir'),

    apiLink = 'https://cloud-api.yandex.net/v1/disk/resources/',
    HEADERS_COMMON,
    client,
    self;


function InitMod (params) {
    this.ydClientId = params.ydClientId;
    this.ydClientPass = params.ydClientPass;
    this.ydAccessToken = params.ydAccessToken;
    this.svnUsername = params.svnUsername;
    this.svnPassword = params.svnPassword;
    this.svnRepo = params.svnRepo;
    this.svnWorkingPath = params.svnWorkingPath;
    this.rootFolder = params.rootFolder;// название корневой папки архива на yandex Диск
    this.cb = params.callback
    self = this
}

InitMod.prototype.run = function(){
    // init svn client
    client = new SvnClient({
        cwd: self.svnRepo,
        username: self.svnUsername,
        password: self.svnPassword,
        noAuthCache: true,
    });
    
    HEADERS_COMMON = { 'Authorization': 'OAuth ' + self.ydAccessToken }

    return new Promise(function(reslove, reject) {
        // пересоздаём временную локальную папку
        rmdir(self.svnRepo, function (err, dirs, files) {
            fs.mkdirSync(self.svnRepo);
            console.log('Create/re-create temporary local folder: ' + self.svnRepo);
            reslove();
        });
    })
    .then(function(response) {
        // удаляем папку, в которую будем записывать данные на YaDisk
        return new Promise(function(reslove, reject) {
            request.delete({
                url: apiLink + '?path=%2F' + encodeURIComponent(self.rootFolder),
                headers: HEADERS_COMMON
            }, function(err, httpResponse, body) {
                var href = (body) ? JSON.parse(body).href : null;
                reslove(href);
            });
        });
    })
    .then(function(href) {
        // проверяем статус операции удаления в api YaDisk
        return new Promise(function(reslove, reject){
            if (href) {
                statusRequest(href);
            } else {
                reslove();
            }
            
            function statusRequest(href){
                request.get({
                    url: href,
                    headers: HEADERS_COMMON
                }, function(err, httpResponse, body) {                    
                    if (body && JSON.parse(body).status === 'success') {
                        reslove();
                    } else {
                        statusRequest(href);
                    }
                });
            }
        });        
    })
    .then(function(response) {
        // создаем папку, в которую будем записывать данные на YaDisk
        return new Promise(function(reslove, reject) {
            request.put({
                url: apiLink + '?path=%2F' + encodeURIComponent(self.rootFolder),
                headers: HEADERS_COMMON
            }, function(err, httpResponse, body) {
                console.log('Create/re-create folder on Yandex.Disk: ' + self.rootFolder);
                reslove();
            });
        })        
    })
    .then(function(response) {        
        // копируем данные с SVN в локальную папку
        return new Promise(function(reslove, reject) {
            client.checkout(self.svnWorkingPath, function() {
                reslove();
            });
        })
    })
    .then(function() {
        return new Promise(function(reslove, reject) {
            var files = [];
            var dirTemps = {};
            var directories = [];

            // получаем список загружаемых файлов, список папок
            fn(self.svnRepo);
            // создание папок в Ya.Disk
            addDirectories(directories[0], 0, directories);

            function fn(path){
                fs.readdirSync(path).filter(function (file) {
                    return file !== '.svn';
                }).forEach(function (file, index) {
                    var relPath = path.replace(self.svnRepo, '');
                    if (relPath && typeof (dirTemps[relPath]) === 'undefined') {
                        dirTemps[relPath] = 1;
                        directories.push(relPath);
                    }
                    if (fs.statSync(path + '/' + file).isDirectory()) {
                        fn(path + '/' + file);
                    } else {
                        files.push({
                            fullPath: path + '/' + file,
                            relPath: relPath,
                            name: file
                        });
                    }
                });
            }
            
            function addDirectories(path, i, directories) {
                if (typeof (path) === 'undefined') {
                    reslove(files);
                } else {
                    request.put({
                        url: apiLink + '?path=%2F'+ encodeURIComponent(self.rootFolder + path),
                        headers: HEADERS_COMMON
                    }, function(err, httpResponse, body) {
                        i += 1;
                        addDirectories(directories[i], i, directories);
                    });
                }
            }
        });
    })
    .then(function(files) {
        eachUpload(files[0], 0, files, self.cb);
    })
    .catch(function(err){
        console.log('Ошибка в процессе скачивания/подготовки файлов');
        console.log(err);
    });  
}

// загрузка файлов
function eachUpload(file, index, files, cb){
    try{
        if (typeof (file) === 'undefined') {
            // по завершению переноса удаляем временную локальную папку
            rmdir(self.svnRepo, function (err, dirs, files) {
                console.log('End');
                if (typeof (cb) !== 'undefined') cb();
            });
            return;
        };
        index += 1;
        
        uploadFile({
            file: file,
            callback: function(){
                eachUpload(files[index], index, files);
            }
        });
    } catch(e){
        console.log('1.Ошибка в процессе загрузки файла на Ya.Disk');
        console.error(e);
    }
}

function uploadFile(opts){
    return new Promise(function(reslove, reject) {
        // получение url для записи на Ya.Disk
        request.get({
            url: apiLink + 'upload?path=disk%3A%2F' + encodeURIComponent(self.rootFolder + opts.file.relPath + '/' + opts.file.name),
            headers: HEADERS_COMMON
        },
        function(err, httpResponse, body) {
            opts.hrefForSave = JSON.parse(body).href;
            reslove(opts);
        });
    })
    .then(function(data) {
        // запись файла на Ya.Disk        
        return new Promise(function(reslove, reject) {
            fs.createReadStream(data.file.fullPath)
            .pipe(request.put(data.hrefForSave)
            .on('response', function(response) {
                try{
                    console.log('Loaded: ' + data.file.relPath + '/' + data.file.name);
                    if (typeof (data.callback) === 'function') data.callback();                        
                } catch (e){
                    console.log('2.Ошибка в процессе загрузки файла на Ya.Disk');
                    console.error(e);
                }
            }));
        });
    })
    .catch(function(err){
        console.log('3.Ошибка в процессе загрузки файла на Ya.Disk');
        console.log(err);
    });  
}


// Получить Код подтверждения (через браузер)
function getLinkForGetCode (){
    var authorizePath = "https://oauth.yandex.ru/authorize?response_type=code&client_id="+ self.ydClientId + "&force_confirm=yes";
    console.log('href: ', authorizePath);
    return authorizePath;
}

// Получить Токен по Коду подтверждения
function getToken (confirmationCode, clientId, clientPass){
    request.post({
        url: "https://oauth.yandex.ru/token",
        form: {
            grant_type: 'authorization_code',
            code: confirmationCode,
            client_id: clientId,
            client_secret: clientPass
        }
    },
    function(err, httpResponse, body){
        console.log(body);
    });
}

module.exports = {
    InitMod: InitMod,
    getLinkForGetCode: getLinkForGetCode,
    getToken: getToken
}