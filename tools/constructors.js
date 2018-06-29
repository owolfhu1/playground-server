//makes an id..
const makeId = () => {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < 8; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

//========constructors========

//chat room factory
function ChatRoom() {
    this.type = 'chat';
    this.id = makeId();
    this.members = [];
}

//shared document factory
function Doc(chat) {
    this.type = 'doc';
    this.id = makeId();
    this.chatId = chat.id;
    this.members = chat.members;
}

module.exports = {ChatRoom,Doc};