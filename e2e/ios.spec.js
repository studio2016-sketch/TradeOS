const {test,expect}=require("@playwright/test");
const base=process.env.TRADEOS_BASE_URL||"https://tradeos-lac.vercel.app";
test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
test("iPhone-sized WebKit layout preserves the header and stock search separation",async({page})=>{
 await page.goto(base+"/",{waitUntil:"domcontentloaded"});
 const header=page.locator(".tradeosMobileHeader"), search=page.locator(".tradeosSymbolSection");
 await expect(header).toBeVisible();
 await expect(search).toBeVisible();
 const h=await header.boundingBox(),s=await search.boundingBox();
 expect(h&&s).toBeTruthy();
 expect(h.y+h.height).toBeLessThanOrEqual(s.y+2);
 await expect(page.getByRole("combobox")).toBeVisible();
});
test("Mobile WebKit stock search selects an actual provider-supported security",async({page})=>{
 await page.goto(base+"/live-board",{waitUntil:"domcontentloaded"});
 const input=page.getByRole("combobox");
 await input.fill("AAPL");
 const option=page.getByRole("option",{name:/^AAPL\s*·/i});
 await expect(option).toBeVisible({timeout:25000});
 await option.click();
 await expect(page.getByText("AAPL · 5-minute historical market bars")).toBeVisible({timeout:30000});
});
