Uncaught (in promise) Error: Access denied for video device [ReferenceError]: ReferenceError: myVideoMirrorBtn is not defined check the common getUserMedia errors: https://blog.addpipe.com/common-getusermedia-errors/
    handleMediaError client.js:2981
    setupLocalVideoMedia client.js:2883
    handleConnect client.js:1199
    emit index.js:136
    onconnect socket.js:612
    onpacket socket.js:500
    emit index.js:136
    ondecoded manager.js:217
    promise callback*nextTick globals.js:4
    ondecoded manager.js:216
    emit index.js:136
    add index.js:142
    ondata manager.js:203
    emit index.js:136
    _onPacket socket.js:259
    emit index.js:136
    onPacket transport.js:99
    onData transport.js:91
    onmessage websocket.js:48
    addEventListeners websocket.js:48
    doOpen websocket.js:30
    open transport.js:47
    _open socket.js:197
    SocketWithoutUpgrade socket.js:150
    SocketWithUpgrade socket.js:565
    Socket socket.js:725
    open manager.js:115
    timer manager.js:354
    setTimeout handler*reconnect manager.js:346
    maybeReconnectOnOpen manager.js:100
    onError manager.js:135
    timer manager.js:147
    setTimeout handler*open manager.js:144
    Manager manager.js:41
    lookup index.js:33
    initClientPeer client.js:1110
    <anonymous> client.js:1089
    EventListener.handleEvent* client.js:1088
client.js:2981:11


I would like to delete this button 