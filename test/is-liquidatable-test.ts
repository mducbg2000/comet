import { expect, exp, makeProtocol, portfolio, Protocol } from './helpers';

describe('Liquidation', function () {
  let _protocol: Protocol;
  beforeEach(async () => {
    const protocol = await makeProtocol({
      base: 'WETH',
      baseBorrowMin: exp(0.1, 18),
      supplyInterestRateBase: 0,
      supplyInterestRateSlopeLow: 0,
      supplyInterestRateSlopeHigh: 0,
      borrowInterestRateBase: 0,
      borrowInterestRateSlopeLow: 0,
      borrowInterestRateSlopeHigh: 0,
      assets: {
        USDC: {
          initial: 1e8,
          decimals: 6,
          borrowCF: exp(0.9, 18),
          initialPrice: 1 / 1500,
          liquidationFactor: exp(1500 / 1520, 18),
          supplyCap: exp(5000, 6)
        },
        WETH: {
          decimals: 18,
        },
        AXS: {
          decimals: 18,
          initialPrice: 1 / 100,
        },
      },
    });
    const {
      comet,
      tokens,
      users: [_absorber, bob],
    } = protocol;
    const { USDC, WETH, AXS } = tokens;

    await WETH.allocateTo(comet.address, exp(10, 18));
    await AXS.allocateTo(comet.address, exp(100, 18));
    await USDC.allocateTo(bob.address, exp(2000, 6));
    // supply 1000 USDC
    await USDC.connect(bob).approve(comet.address, exp(1000, 6));
    await comet.connect(bob).supply(USDC.address, exp(1000, 6));

    // borrow 0.2 ETH + 20 AXS
    await comet.connect(bob).withdraw(WETH.address, exp(0.2, 18));
    await comet.connect(bob).borrow(AXS.address, exp(20, 18));

    _protocol = protocol;
  });

  it('case a - debt position is healthy', async () => {
    const {
      comet,
      users: [_absorber, bob],
    } = _protocol;
    expect(await comet.isLiquidatable(bob.address)).to.be.false;
  });

  it('case b - debt position becomes unhealthy after exchange rates for AXS change', async () => {
    const {
      comet,
      users: [_absorber, bob],
      priceFeeds,
    } = _protocol;
    await priceFeeds.AXS.setRoundData(
      0,
      exp(1 / 48, 8),
      0,
      0,
      0
    );

    expect(await comet.isLiquidatable(bob.address)).to.be.true;
  });

  it('case c - debt position becomes healthy after liquidated', async () => {
    const {
      comet,
      users: [absorber, bob],
      priceFeeds,
      tokens: { USDC }
    } = _protocol;
    await priceFeeds.AXS.setRoundData(
      0,
      exp(1 / 48, 8),
      0,
      0,
      0
    );
    const remainingUSDC = 1000 - 288;
    await comet.connect(bob).withdraw(USDC.address, exp(remainingUSDC, 6));
    await comet.connect(absorber).absorb(absorber.address, [bob.address]);
    // thanh lý xong lại suppy vào 
    await USDC.connect(bob).approve(comet.address, exp(remainingUSDC, 6));
    await comet.connect(bob).supply(USDC.address, exp(remainingUSDC, 6));

    expect(await comet.isLiquidatable(bob.address)).to.be.true;
  });
});
