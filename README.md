# html5Upload.js

## 功能

可以使用`formData`上传文件，也可以直接将文件放到`http`请求`body`中。

## demo

```javascript
    var myHtml5UploadTool ＝ {};

    Html5Upload.init({
        fileEle: domElement, // 原生的input DOM元素
        pasteEle: domElement, // 原生的粘贴区域DOM元素
        dropEle: domElement, // 原生的拖拽区域DOM元素
        cancelAllEle: domElement, // 原生的取消全部文件上传的DOM元素 不可用状态！！！
        isFormData: Boolean, // 是否使用FormData传输数据
        fileKey: String, // 如果使用FormData 文件的key值
        headers: Object, // 传输头的对象
        formData: Object // 需要发送的formData数据，用对象表示
        method: String // 传输的方法
        url: String // 传输的url
        taskLen: Number // 允许同时上传的文件个数
        externalData: Object // 目前仅有 uploadingCount (正在上传中) 这一个属性
        tool: myHtml5UploadTool Object // 目前仅有updateTool这个方法
    }).on("add", function(task){
        if(task.thisQueueEffective == false){
            task.isUpload = false;
            return;
        }
        // 给图片重命名 只有是剪切板的文件的时候才会出现没有文件名的情况
        if(task.name === undefined){
            task.name = "来自剪切板_20150303";
        }
        task.data = data;
        
        if(判断文件不符合规定){
            task.isUpload = false;
        }
    
        if(task.waitingQueueLength > 5){
            // 提示用户不能上传太多文件啦
            task.isUpload = false;
        }
    
        // 绑定元素和操作
        task.el = fileItem;
        task.cancelEle = fileItem.querySelector(".file-cancel");
    }).on("progress", function(task){
        task.progress.percent; // "33%"
        task.progress.loadedSize; // "3.3MB"
        task.progress.percentSize; // "3.3MB/33MB"
    }).on("complete", function(task){
        // 上传完成 但是还没有收到返回
    }.on("success", function(task){
        // 上传成功
        task.response;  //返回的消息体
    }).on("error", function(task){
        // 上传失败
    }).on("cancelBefore", function(task){
        // 取消上传之前 isUpload 为false就会取消
        if(确定取消上传){
            task.isUpload = false;
            task.cancel();
        }
    }).on("cancel", function(task){
        // 取消上传 可以做删除DOM之类的操作
    });
    
    myHtml5UploadTool.addFile(somefile);
```
## demo 解释

**task**

task中本身就带有的属性

- `file` 文件对象
- `type` 文件的mimeType
- `name` 文件名字 如果是剪切板获得的 就没有名字 需要自己指定
- `formatSize` 经过格式化后的文件大小
- `cancelEle` 取消文件上传绑定的DOM元素
- `waitingQueueLength` 正在等待上传的文件个数
- `thisQueueEffective` 本次上传队列是否可用

task中可更改的属性

- `isFormData` 是否使用FormData传输数据
- `fileKey` 如果使用FormData 文件的key值
- `el` 建议将需要更改的DOM元素绑定到这个变量上
- `headers` 传输头，用对象表示
- `formData` 需要发送的formData数据，用对象表示
- `method` 传输的方法
- `url` 传输的url
- `isUpload` 是否允许上传
- `isWaiting` 是否等待用户确认
- `blobName` formData数据中文件名

task中可更改的方法
- `waitingToOk` 从等待状态到可以上传
- `waitingToCancel` 从等待状态到可以上传