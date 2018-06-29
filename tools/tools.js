//hashes a string
const hash = s => {
    let a = 1;
    let c = 0;
    let h, o;
    if (s) {
        a = 0;
        for (h = s.length - 1; h >= 0; h--) {
            o = s.charCodeAt(h);
            a = (a<<6&268435455) + o + (o<<14);
            c = a & 266338304;
            a = c!==0?a^c>>21:a;
        }
    }
    return String(a);
};

//returns a list of keys in a map
const getList = Map => {
    let list = [];
    for (let key in Map) {
        list.push(key);
    }
    return list;
};

module.exports = {hash,getList};