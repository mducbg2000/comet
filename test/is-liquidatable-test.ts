import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CometHarnessInterface, SimplePriceFeed } from '../build/types';
import { expect, exp, makeProtocol } from './helpers';

describe('Liquidation', function () {
  let _comet: CometHarnessInterface;
  let _AXS_PriceFeeds: SimplePriceFeed;
  let _bob: SignerWithAddress;
  beforeEach(async () => {
    const {
      comet,
      tokens,
      users: [bob],
      priceFeeds
    } = await makeProtocol({
      base: 'WETH',
      baseBorrowMin: exp(0.1, 18),
      assets: {
        USDC: {
          initial: 1e8,
          decimals: 6,
          borrowCF: exp(0.9, 18),
          initialPrice: 1 / 1500,
          liquidationFactor: exp(0.9868, 18),
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
    _comet = comet;
    _AXS_PriceFeeds = priceFeeds.AXS;
    _bob = bob;
  });

  it('case a - debt position is healthy', async () => {
    expect(await _comet.isLiquidatable(_bob.address)).to.be.false;
  });

  it('case b - debt position becomes unhealthy after exchange rates for AXS change', async () => {
    await _AXS_PriceFeeds.setRoundData(
      0,
      exp(1 / 48, 8),
      0,
      0,
      0
    );

    expect(await _comet.isLiquidatable(_bob.address)).to.be.true;
  });

  // it('case c - debt position becoes healthy after liquidated', async () => {

  // });
});
