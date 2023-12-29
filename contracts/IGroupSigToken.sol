import "./PS/PS.sol";

interface IGroupSigToken {
    function transferVerified(PS.PSSignature calldata _pssignature, address to, uint256 amount) external returns (bool);
}
