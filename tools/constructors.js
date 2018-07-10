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

function ConnectFour(chat) {
    this.type = 'con_4';
    this.id = makeId();
    this.chatId = chat.id;
    this.members = chat.members;
    let turn = 0;
    this.turn = () => this.members[turn];
    this.nextTurn = () => turn = this.members.length === ++turn ? 0 : turn;
}

function SpecialGame(chat) {
    this.type = 'spec';
    this.id = makeId();
    this.chatId = chat.id;
    this.members = chat.members;
}

module.exports = {ChatRoom,Doc,ConnectFour,SpecialGame};