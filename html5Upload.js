(function(window, factory) {
    if(typeof exports === 'object') {

        module.exports = factory();
    }else if(typeof define === 'function' && define.amd) {

        define(factory);
    }else {

        window.Html5Upload = factory();
    }
})(this, function() {
    function Html5Upload() {

    }

    // 初始化方法
    Html5Upload.init = function(param) {
        if(param.externalData !== undefined){
            param.externalData.uploadingCount = 0;
        }

        function _inlineUpload() {
            // event's handlers
            this._addHandlers = [];
            this._progressHandlers = [];
            this._completeHandlers = [];
            this._successHandlers = [];
            this._errorHandlers = [];
            this._cancelHandlers = [];
            this._cancelBeforeHandlers = [];
            this._loadstartHandlers = [];
        }

        _inlineUpload.prototype = {
            constructor: _inlineUpload,

            // 创建任务 file 是获取到的文件对象 param 是 init 方法传入的参数
            _createTask: function(file, thisUploadQueue) {
                var _self = this;
                // 初始化 taskObj
                var taskObj = {};
                taskObj.file = file;
                taskObj.type = file.type;
                taskObj.name = file.name;
                taskObj.formatSize = this._calaSize(file.size);
                taskObj.isUpload = true; // 是否可以上传
                taskObj.isWaiting = false; // 是否等待用户上传
                taskObj.waitingQueueLength = _self._getWaitingCount();
                if(thisUploadQueue !== undefined){
                    taskObj.thisQueueEffective = thisUploadQueue.thisQueueEffective;
                }
                taskObj.waitingToOk = function(){
                    taskObj.isWaiting = false;
                    _self._taskListener();
                };
                taskObj.waitingToCancel = function(){
                    taskObj.isUpload = false;
                    _self._taskListener();
                };

                // add之前将 param 的属性 赋值到 taskObj上 为了可以让 add 方法覆盖
                taskObj.isFormData = param.isFormData;
                taskObj.fileKey = param.fileKey;
                taskObj.formData = param.formData;
                taskObj.headers = param.headers;
                taskObj.method = param.method;
                taskObj.url = param.url;

                // 先触发 add 事件 为了让用户可以给 undefined 的文件命名 如果本次队列失效 那么直接忽略 也不会触发add
                this._add(taskObj);

                if(taskObj.thisQueueEffective === false){
                    thisUploadQueue.thisQueueEffective = false;
                }

                if(taskObj.isUpload === false) {
                    // 如果 add 的时候判断不符合上传的条件，需要取消后续操作
                    return;
                }

                // 初始化 xhr
                taskObj._xhr = new XMLHttpRequest();
                var url = taskObj.url;
                var method = taskObj.method;
                taskObj._xhr.open(method, url, true); // 需要先 open 因为 设置 header 必须在 open 状态下
                taskObj._isUploading = false; // 是否长传完成 success 后变为 true

                // 对 xhr 对象 loadstart、progress、load、error、abort 事件的监听
                taskObj._xhr.upload.addEventListener("loadstart", function(e) {
                    _self._loadstart(taskObj);
                }, false);
                taskObj._xhr.upload.addEventListener("progress", function(e) {
                    var loadedSize = _self._calaSize(e.loaded);
                    var percent = Math.round(e.loaded * 100 / e.total) + "%";
                    var totalSize = _self._calaSize(e.total);

                    taskObj.progress = {
                        percent: percent,
                        loadedSize: loadedSize,
                        percentSize: loadedSize + "/" + totalSize
                    };
                    _self._progress(taskObj);
                    if(e.loaded === e.total) {
                        _self._complete(taskObj);
                    }
                }, false);
                taskObj._xhr.addEventListener("load", function(e) {
                    _self._success(taskObj, e.target.response);
                }, false);
                taskObj._xhr.addEventListener("error", function(e) {
                    _self._error(taskObj);
                }, false);
                taskObj._xhr.addEventListener("abort", function(e) {
                    _self._cancel(taskObj);
                }, false);


                // 截图文件名重写 add 的时候可能会对图片进行重命名操作
                taskObj.name && (file.name = taskObj.name);

                // 设置头信息
                if(taskObj.headers) {
                    for(var key in taskObj.headers) {
                        taskObj._xhr.setRequestHeader(key, taskObj.headers[key]);
                    }
                }

                // 设置FormData数据
                if(taskObj.formData) {
                    taskObj._fd = new FormData();
                    for(var key in taskObj.formData) {
                        taskObj._fd.append(key, taskObj.formData[key]);
                    }
                    if(taskObj.blobName !== undefined){
                        taskObj._fd.append(taskObj.fileKey, taskObj.file, taskObj.blobName);
                    } else {
                        taskObj._fd.append(taskObj.fileKey, taskObj.file);
                    }
                }

                taskObj._send = function() {
                    if(taskObj.isFormData) {
                        this._xhr.send(this._fd);
                    }else {
                        this._xhr.send(this.file);
                    }
                };

                taskObj.cancel = function(){
                    taskObj._xhr.abort();
                    _self._endTask(taskObj);
                    _self._taskListener();
                };

                // 取消上传事件绑定
                if (taskObj.cancelEle) {
                    taskObj.cancelEle.addEventListener("click", function () {
                        if(_self._cancelBeforeHandlers.length > 0){
                            _self._cancelBefore(taskObj);
                        } else {
                            taskObj.cancel();
                        }
                    }, false);
                }

                // 将任务 push进 任务队列
                this._taskQueue.push(taskObj);
                this._taskListener();
            },


            // 队列管理模块
            _taskQueue: [],
            taskLen: param.taskLen || 4, //可以允许用户自定义任务个数，默认是4
            _taskListener: function() {
                var tempCnt = 0;

                // 剔除不能上传的
                for(var i = 0; i < this._taskQueue.length; i++){
                    if(this._taskQueue[i].isUpload === false){
                        this._taskQueue.splice(i, 1);
                        i--;
                    }
                }

                // 找到可以上传的
                for(var i = 0; i < this._taskQueue.length; i++){
                    if(tempCnt >= this.taskLen){
                        break;
                    }
                    if(this._taskQueue[i]._isUploading === true){
                        tempCnt++;
                        continue;
                    }
                    if(this._taskQueue[i]._isUploading === false && this._taskQueue[i].isWaiting === false) {
                        tempCnt++;
                        this._taskQueue[i]._send();
                        this._taskQueue[i]._isUploading = true;
                    }
                }

                if(param.externalData !== undefined){
                    param.externalData.uploadingCount = this._getUploadingCount();
                }
                //console.log(param.externalData);

            },
            _getWaitingCount: function(){
                var cnt = 0;
                var len = this._taskQueue.length;
                for(var i = 0; i < len; i++){
                    if(this._taskQueue[i]._isUploading === false){
                        cnt++;
                    }
                }

                return cnt;
            },
            _getUploadingCount: function() {
                var cnt = 0;
                for(var i = 0, len = this._taskQueue.length; i < len; i++) {
                    if(this._taskQueue[i]._isUploading === true) {
                        cnt++;
                    }
                }

                return cnt;

            },
            _endTask: function(taskObj) {
                for(var i = 0, len = this._taskQueue.length; i < len; i++) {
                    if(taskObj === this._taskQueue[i]) {
                        this._taskQueue.splice(i, 1); // 还需要清出内存吗 应该不需要abort的
                    }
                }
            },
            _endAllTask: function() {
                console.log(this._taskQueue);
                var _this = this;
                for(var i = 0, len = this._taskQueue.length; i < len; i++) {
                    ;(function(i) {
                        try {
                            console.log(_this._taskQueue[i]._xhr.abort, i);
                            _this._taskQueue[i]._xhr.abort();
                        }catch(e) {
                            console.log(e);
                        }
                    })(i);
                }
                this._taskQueue.splice(0, this._taskQueue.length);
            },

            // 计算尺寸方法
            _calaSize: function(size) {
                var formatSize = "";

                if(size >= 1024 * 1024 && size < 1024 * 1024 * 1024) {
                    formatSize = Math.round(size / 1024 / 1024 * 100) / 100 + "MB";
                }else if(size >= 1024 * 1024 * 1024) {
                    formatSize = Math.round(size / 1024 / 1024 / 1024 * 100) / 100 + "GB";
                }else {
                    formatSize = Math.round(size / 1024 * 100) / 100 + "KB";
                }

                return formatSize;
            },

            // 添加文件之后 上传文件之前的处理
            _add: function(taskObj) {
                for(var i = 0, len = this._addHandlers.length; i < len; i++) {
                    this._addHandlers[i](taskObj);
                }
            },
            _loadstart: function(taskObj) {
                for(var i = 0, len = this._loadstartHandlers.length; i < len; i++) {
                    this._loadstartHandlers[i](taskObj);
                }
            },
            // 文件传输过程中
            _progress: function(taskObj) {
                for(var i = 0, len = this._progressHandlers.length; i < len; i++) {
                    this._progressHandlers[i](taskObj);
                }
            },
            // 文件上传完成 但是还没有得到服务端返回
            _complete: function(taskObj) {
                for(var i = 0, len = this._completeHandlers.length; i < len; i++) {
                    this._completeHandlers[i](taskObj);
                }
            },
            // 文件上传成功 已经得到了服务端的返回
            _success: function(taskObj, response) {
                taskObj._isUploading = false;
                taskObj.response = response;
                for(var i = 0, len = this._successHandlers.length; i < len; i++) {
                    this._successHandlers[i](taskObj);
                }
                this._endTask(taskObj);
                this._taskListener();
            },
            // 文件上传失败
            _error: function(taskObj) {
                taskObj._isUploading = false;
                for(var i = 0, len = this._errorHandlers.length; i < len; i++) {
                    this._errorHandlers[i](taskObj);
                }
                this._endTask(taskObj);
                this._taskListener();
            },

            // 文件已经取消上传
            _cancel: function(taskObj) {
                taskObj._isUploading = false;

                for(var i = 0, len = this._cancelHandlers.length; i < len; i++) {
                    this._cancelHandlers[i](taskObj);
                }
                this._endTask(taskObj);
                this._taskListener();
            },
            // 文件取消上传之前
            _cancelBefore: function(taskObj) {
                for(var i = 0, len = this._cancelBeforeHandlers.length; i < len; i++) {
                    this._cancelBeforeHandlers[i](taskObj);
                }
            },

            // 事件注册方法
            on: function(event, handler) {
                var eventObj = {
                    "add": this._addHandlers,
                    "progress": this._progressHandlers,
                    "complete": this._completeHandlers,
                    "success": this._successHandlers,
                    "error": this._errorHandlers,
                    "cancel": this._cancelHandlers,
                    "cancelBefore": this._cancelBeforeHandlers,
                    "loadStart": this._loadstartHandlers
                };

                if(eventObj[event] !== undefined) {
                    eventObj[event].push(handler);
                }else {
                    console.error("not find " + event + " event");
                }

                return this;
            }
        };// prototype 结束

        var _instance = new _inlineUpload();

        // 自己上传
        if(param.tool){
            param.tool.addFile = function(file){
                _instance._createTask(file);
            }
        }

        // 从input获得文件
        param.fileEle && param.fileEle.addEventListener("change", function(e) {
            var thisUploadQueue = {
                files: this.files,
                thisQueueEffective: true
            };
            for(var i = 0, len = this.files.length; i < len; i++) {
                var file = this.files[i];
                _instance._createTask(file, thisUploadQueue, param);
            }
            e.target.value = null;

        }, false);

        // 从剪切板获得图片
        param.pasteEle && param.pasteEle.addEventListener("paste", function(e) {
            var clp = e.clipboardData;

            // 剪切板图片
            if(clp.types.length === 1 && clp.types[0] === "Files" && clp.items.length === 1 &&
                clp.items[0].kind === "file" && clp.items[0].type.match(/^image\//i)) {
                var pasteFile = clp.items[0].getAsFile();
                var thisUploadQueue = {
                    files: pasteFile,
                    thisQueueEffective: true
                };
                _instance._createTask(pasteFile, thisUploadQueue, param);
            }

            // 电子表格转化为图片
            if(clp.types.length === 4 && clp.types[3] === "Files" && clp.items.length === 4 &&
                clp.items[3].kind === "file" && clp.items[3].type.match(/^image\//i)) {
                var pasteFile = clp.items[3].getAsFile();
                var thisUploadQueue = {
                    files: pasteFile,
                    thisQueueEffective: true
                };
                _instance._createTask(pasteFile, thisUploadQueue, param);
            }

        }, false);

        // 从拖拽获得文件
        param.dropEle && param.dropEle.addEventListener("dragenter", function(e) {
            console.log("dragenter");
            e.preventDefault();
            e.stopPropagation();
        }, false);
        param.dropEle && param.dropEle.addEventListener("dragover", function(e) {
            console.log("dragover");
            e.dataTransfer.dropEffect = 'copy'; // 兼容圈点APP
            e.preventDefault();
            e.stopPropagation();
        }, false);
        param.dropEle && param.dropEle.addEventListener("dragleave", function(e){
            console.log("dragleave");
            // 圈点APP的拖拽只会有这个事件 没有drop事件
            e.preventDefault();
            e.stopPropagation();
        });
        param.dropEle && param.dropEle.addEventListener("drop", function(e) {
            e.preventDefault();
            e.stopPropagation();
            var df = e.dataTransfer;
            var dropFiles = [];

            if(df.items !== undefined){
                // Chrome 不让文件夹上传
                for(var i = 0; i < df.items.length; i++){
                    // Chrome 不让文件夹上传
                    var item = df.items[i];
                    if(item.kind === "file" && item.webkitGetAsEntry().isFile) {
                        var file = item.getAsFile();
                        dropFiles.push(file);
                    }
                }
            } else {
                // Safari 文件夹问题暂时先不解决 是为了防止用户上传没有后缀的文件会失败
                for(var i = 0; i < df.files.length; i++){
                    dropFiles.push(df.files[i]);
                }
            }

            // 之所以不这么写是因为 files 和 items 的数量并不是严格相同的 比如QQ截图就不一样 files是1 items是2
            //for(var i = 0; i < df.files.length; i++){
            //    console.log(i, df.files[i]);
            //    if(df.items !== undefined){
            //        // Chrome 不让文件夹上传
            //        var item = df.items[i];
            //        console.log(i, item.kind);
            //        if(item.kind === "file" && item.webkitGetAsEntry().isFile) {
            //            var file = item.getAsFile();
            //            dropFiles.push(file);
            //        }
            //    } else {
            //        // Safari 文件夹问题暂时先不解决 是为了防止用户上传没有后缀的文件会失败
            //        dropFiles.push(df.files[i]);
            //    }
            //}

            // 最古老的写法了
            //for(var i = 0; i < df.items.length; i++){
            //    var item = df.items[i];
            //    console.log(i, item.kind, JSON.stringify(item));
            //    if(item.kind === "file" && item.webkitGetAsEntry().isFile) {
            //        var file = item.getAsFile();
            //        dropFiles.push(file);
            //    }
            //}

            var thisUploadQueue = {
                files: dropFiles,
                thisQueueEffective: true
            };
            for(var i = 0, len = dropFiles.length; i < len; i++) {
                _instance._createTask(dropFiles[i], thisUploadQueue, param);
            }
        }, false);

        // 取消所有文件上传
        param.cancelAllEle && param.cancelAllEle.addEventListener("click", function() {
            _instance._endAllTask();
        }, false);

        return _instance;
    };

    return Html5Upload;
});