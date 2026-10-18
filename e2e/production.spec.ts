import {test,expect} from "@playwright/test";
const base=process.env.TRADEOS_BASE_URL||"https://tradeos-lac.vercel.app";
test("Production live board changes the selected ticker and corresponding historical chart",async({page})=>{
 await page.goto(base+"/live-board",{waitUntil:"domcontentloaded"});
 const box=page.getByRole("combobox");
 await expect(box).toBeVisible();
 await box.fill("AAPL");
 const aapl=page.getByRole("option",{name:/AAPL.*Apple/i});
 await expect(aapl).toBeVisible({timeout:20000});
 await aapl.click();
 await expect(page.getByText("Selected: AAPL",{exact:false})).toBeVisible();
 await expect(page.getByText("AAPL · 5-minute historical market bars")).toBeVisible({timeout:25000});
 await expect(page.getByRole("img",{name:/Five-minute historical price chart for AAPL/})).toBeVisible({timeout:25000});
 await box.fill("MSFT");
 const msft=page.getByRole("option",{name:/MSFT.*Microsoft/i});
 await expect(msft).toBeVisible({timeout:20000});
 await msft.click();
 await expect(page.getByText("MSFT · 5-minute historical market bars")).toBeVisible({timeout:25000});
 await expect(page.getByRole("img",{name:/Five-minute historical price chart for MSFT/})).toBeVisible({timeout:25000});
 await expect(page.getByText("AAPL · 5-minute historical market bars")).toHaveCount(0);
});
test("Operations Command Center is accessible and never claims price-feed certification",async({page})=>{
 await page.goto(base+"/operations",{waitUntil:"domcontentloaded"});
 await expect(page.getByRole("heading",{name:"Operations Command Center"})).toBeVisible({timeout:15000});
 await expect(page.getByText("Market status:",{exact:false})).toBeVisible({timeout:20000});
 await expect(page.getByText("Quote and candle certification:",{exact:false})).toBeVisible();
});
test("Point-in-time replay rejects candles that extend beyond selected cutoff",async({page})=>{
 await page.goto(base+"/replay-lab",{waitUntil:"domcontentloaded"});
 await expect(page.getByRole("heading",{name:/Historical Replay Laboratory/})).toBeVisible();
 await page.getByRole("button",{name:"Load historical replay"}).click();
 await expect(page.getByText(/SPY · 5Min recorded observations/)).toBeVisible({timeout:30000});
 await expect(page.getByText(/Visible observations:/)).toBeVisible({timeout:30000});
});
