//make cards from these suits/values
let suits = ['♣', '♥', '♦', '♠'];
let values = ['A','2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K' ];

function Card(s,v) {
    this.s = s;
    this.v = v;
}

const shuffle = a => {
    let j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
};



//makes a deck with functions like draw()
export default function (jokers) {

    //the deck, private
    let deck = [];

    //function lets deck get rebuilt after it has been made
    this.rebuildDeck = () => {

        //if deck has jokers add them
        if (jokers)
            for(let i in [1,2])
                deck.push(new Card('J','Joker'));

        //make all the cards
        for (let s in suits)
            for (let v in values)
                deck.push(new Card(values[v], suits[s]));

        //shuffle the deck
        deck = shuffle(deck);

    };

    //make the deck
    this.rebuildDeck();

    this.draw = () => deck.pop();





}