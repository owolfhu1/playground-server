/**@param endGameCallback {function} handles end of game, function on winner (-1, 1 or 0(draw))
 * @constructor
 */
const Game = function(endGameCallback) {
    
    //the game board
    const board = [
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0],
    ];
    
    //true = [1] chip, false = [-1] chip
    let one = true;
    
    //given (x,y) coordinate, checks if win, draw, or nether returning 'win', 'draw', or '' for neither
    const checkBoard = (x,y) => {
        let chip = one ? 1 : -1;
        let result = '';
        
        //check vertical
        let count = 0;
        for (let yy = y; yy < 6; yy++){
            if (board[yy][x] === chip)
                count++;
            else
                yy = 666;
        }
        if (count > 3)
            result = 'win';
        
        //check horizontal
        count = 0;
        let xx = x;
        while (xx > -1 && board[y][xx] === chip) {--xx;}
        xx++;
        while (xx < 6) {
            if (board[y][xx] === chip) {
                count++;
                xx++;
            }
            else
                xx = 666;
        }
        if (count > 3)
            result = 'win';
        
        //check up diagonal
        count = 0;
        xx = x;
        let yy = y;
        while (xx > -1 && yy < 6 && board[yy][xx] === chip) {--xx;++yy;}
        yy--;
        xx++;
        while (xx < 7 && yy > -1) {
            if (board[yy][xx] === chip) {
                count++;
                xx++;
                yy--;
            }
            else
                xx = 666;
        }
        if (count > 3)
            result = 'win';
        
        //check down diagonal
        count = 0;
        xx = x;
        yy = y;
        while (xx > -1 && yy > -1 && board[yy][xx] === chip) {--xx;--yy;}
        xx++;
        yy++;
        while (xx < 7 && yy < 6) {
            if (board[yy][xx] === chip) {
                count++;
                xx++;
                yy++;
            }
            else
                xx = 666;
        }
        if (count > 3)
            result = 'win';
        
        //check if game over
        if (!result){
            count = 0;
            for (let i = 0; i < 7; i++)
                if (board[0][i] !== 0)
                    count++;
            if (count === 7)
                result = 'draw';
        }
        
        //return the result
        return result;
        
    };
    
    /**@param x {number} x value of chip drop (0 - 6)
     * @param callback {function} callback(success,board);*/
    this.addChip = (x, callback) => {
        let chip = one ? 1 : -1;
        let bool = false;
        let y = 0;
        let falling = true;
        let boardResult;
        
        //if the chip is playable, ie spot at top is free
        if(board[0][x] === 0){
            
            //chip can be played so flip bool
            bool = true;
            
            //drop the chip in
            while (falling) {
                
                //if at the bottom
                if (y === 5)
                    falling = false;
                
                //else if spot below is empty, fall
                else if (board[y + 1][x] === 0)
                    ++y;
                
                //otherwise stop falling
                else
                    falling = false;
            }
            
            //chip lands at the top of the chip stack
            board[y][x] = chip;
            
            //check board
            boardResult = checkBoard(x,y);
            
            //flip turn
            one = !one;
        }
        
        //run callback
        callback(bool, board);
        
        //if the game is over (result isn't '')
        if (boardResult)
            endGameCallback(boardResult === 'win' ? (one ? -1 : 1) : 0)
        
    }
    
};

module.exports = Game;

