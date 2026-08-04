contract SplitCounter() {
    int x;
    int y;
    function setX(int value) { this.x = value; require(value >= 0); }
    function addX(int value) { this.x = this.x + value; require(value >= 0); }
    function setXReturning(int value) returns (int) { this.x = value; require(value >= 0); return value; }
    function setY(int value) { this.y = value; require(value >= 0); }
    function getX() view returns (int) { return this.x; }
}
