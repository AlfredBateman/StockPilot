// The universe of tickers the snapshot script fetches: NIFTY 50 + NIFTY NEXT 50.
//
// Source: Wikipedia's "NIFTY 50" and "NIFTY Next 50" constituent tables
// (fetched 2026-09-22). `name`/`index` here are review labels only — the
// snapshot never copies them into data/stocks.json; the company name and
// sector in the output always come live from Yahoo Finance itself.
//
// PLEASE REVIEW before relying on this list. Index membership changes over
// time. Every symbol below was checked live against Yahoo Finance
// (yahooFinance.quote()) before this file was committed, which caught one
// stale symbol (LTIMindtree renamed to "LTM Limited", ticker LTM, in March
// 2026) and confirmed three other recent (2025) corporate-action listings I
// could not verify from memory alone: TMPV and TMCV (the two entities Tata
// Motors split into) and ENRIN (Siemens Energy India, demerged from Siemens
// Ltd). All 100 symbols resolved with a matching company name at the time of
// writing, but please still sanity-check the list.

type TickerEntry = {
  /** Yahoo Finance / NSE symbol, e.g. "RELIANCE.NS". */
  symbol: string;
  /** Company name, for human review only. */
  name: string;
  index: "NIFTY_50" | "NIFTY_NEXT_50";
};

export const TICKERS: TickerEntry[] = [
  // --- NIFTY 50 ---
  { symbol: "ADANIENT.NS", name: "Adani Enterprises", index: "NIFTY_50" },
  { symbol: "ADANIPORTS.NS", name: "Adani Ports & SEZ", index: "NIFTY_50" },
  { symbol: "APOLLOHOSP.NS", name: "Apollo Hospitals", index: "NIFTY_50" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints", index: "NIFTY_50" },
  { symbol: "AXISBANK.NS", name: "Axis Bank", index: "NIFTY_50" },
  { symbol: "BAJAJ-AUTO.NS", name: "Bajaj Auto", index: "NIFTY_50" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance", index: "NIFTY_50" },
  { symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv", index: "NIFTY_50" },
  { symbol: "BEL.NS", name: "Bharat Electronics", index: "NIFTY_50" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel", index: "NIFTY_50" },
  { symbol: "CIPLA.NS", name: "Cipla", index: "NIFTY_50" },
  { symbol: "COALINDIA.NS", name: "Coal India", index: "NIFTY_50" },
  { symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories", index: "NIFTY_50" },
  { symbol: "EICHERMOT.NS", name: "Eicher Motors", index: "NIFTY_50" },
  { symbol: "ETERNAL.NS", name: "Eternal (formerly Zomato)", index: "NIFTY_50" },
  { symbol: "GRASIM.NS", name: "Grasim Industries", index: "NIFTY_50" },
  { symbol: "HCLTECH.NS", name: "HCLTech", index: "NIFTY_50" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", index: "NIFTY_50" },
  { symbol: "HDFCLIFE.NS", name: "HDFC Life", index: "NIFTY_50" },
  { symbol: "HINDALCO.NS", name: "Hindalco Industries", index: "NIFTY_50" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever", index: "NIFTY_50" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank", index: "NIFTY_50" },
  { symbol: "INDIGO.NS", name: "InterGlobe Aviation (IndiGo)", index: "NIFTY_50" },
  { symbol: "INFY.NS", name: "Infosys", index: "NIFTY_50" },
  { symbol: "ITC.NS", name: "ITC", index: "NIFTY_50" },
  { symbol: "JIOFIN.NS", name: "Jio Financial Services", index: "NIFTY_50" },
  { symbol: "JSWSTEEL.NS", name: "JSW Steel", index: "NIFTY_50" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", index: "NIFTY_50" },
  { symbol: "LT.NS", name: "Larsen & Toubro", index: "NIFTY_50" },
  { symbol: "M&M.NS", name: "Mahindra & Mahindra", index: "NIFTY_50" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki", index: "NIFTY_50" },
  { symbol: "MAXHEALTH.NS", name: "Max Healthcare", index: "NIFTY_50" },
  { symbol: "NESTLEIND.NS", name: "Nestlé India", index: "NIFTY_50" },
  { symbol: "NTPC.NS", name: "NTPC", index: "NIFTY_50" },
  { symbol: "ONGC.NS", name: "Oil and Natural Gas Corporation", index: "NIFTY_50" },
  { symbol: "POWERGRID.NS", name: "Power Grid Corporation", index: "NIFTY_50" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", index: "NIFTY_50" },
  { symbol: "SBILIFE.NS", name: "SBI Life Insurance", index: "NIFTY_50" },
  { symbol: "SHRIRAMFIN.NS", name: "Shriram Finance", index: "NIFTY_50" },
  { symbol: "SBIN.NS", name: "State Bank of India", index: "NIFTY_50" },
  { symbol: "SUNPHARMA.NS", name: "Sun Pharmaceutical Industries", index: "NIFTY_50" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", index: "NIFTY_50" },
  { symbol: "TATACONSUM.NS", name: "Tata Consumer Products", index: "NIFTY_50" },
  { symbol: "TMPV.NS", name: "Tata Motors Passenger Vehicles", index: "NIFTY_50" },
  { symbol: "TATASTEEL.NS", name: "Tata Steel", index: "NIFTY_50" },
  { symbol: "TECHM.NS", name: "Tech Mahindra", index: "NIFTY_50" },
  { symbol: "TITAN.NS", name: "Titan Company", index: "NIFTY_50" },
  { symbol: "TRENT.NS", name: "Trent", index: "NIFTY_50" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement", index: "NIFTY_50" },
  { symbol: "WIPRO.NS", name: "Wipro", index: "NIFTY_50" },

  // --- NIFTY NEXT 50 ---
  { symbol: "ABB.NS", name: "ABB India", index: "NIFTY_NEXT_50" },
  { symbol: "ADANIENSOL.NS", name: "Adani Energy Solutions", index: "NIFTY_NEXT_50" },
  { symbol: "ADANIGREEN.NS", name: "Adani Green Energy", index: "NIFTY_NEXT_50" },
  { symbol: "ADANIPOWER.NS", name: "Adani Power", index: "NIFTY_NEXT_50" },
  { symbol: "AMBUJACEM.NS", name: "Ambuja Cements", index: "NIFTY_NEXT_50" },
  { symbol: "BAJAJHLDNG.NS", name: "Bajaj Holdings", index: "NIFTY_NEXT_50" },
  { symbol: "BANKBARODA.NS", name: "Bank of Baroda", index: "NIFTY_NEXT_50" },
  { symbol: "BPCL.NS", name: "Bharat Petroleum", index: "NIFTY_NEXT_50" },
  { symbol: "BRITANNIA.NS", name: "Britannia Industries", index: "NIFTY_NEXT_50" },
  { symbol: "BOSCHLTD.NS", name: "Bosch", index: "NIFTY_NEXT_50" },
  { symbol: "CANBK.NS", name: "Canara Bank", index: "NIFTY_NEXT_50" },
  { symbol: "CGPOWER.NS", name: "CG Power and Industrial Solutions", index: "NIFTY_NEXT_50" },
  { symbol: "CHOLAFIN.NS", name: "Cholamandalam Investment and Finance", index: "NIFTY_NEXT_50" },
  { symbol: "CUMMINSIND.NS", name: "Cummins India", index: "NIFTY_NEXT_50" },
  { symbol: "DIVISLAB.NS", name: "Divi's Laboratories", index: "NIFTY_NEXT_50" },
  { symbol: "DLF.NS", name: "DLF", index: "NIFTY_NEXT_50" },
  { symbol: "DMART.NS", name: "Avenue Supermarts (DMart)", index: "NIFTY_NEXT_50" },
  { symbol: "GAIL.NS", name: "GAIL India", index: "NIFTY_NEXT_50" },
  { symbol: "GODREJCP.NS", name: "Godrej Consumer Products", index: "NIFTY_NEXT_50" },
  { symbol: "HDFCAMC.NS", name: "HDFC Asset Management", index: "NIFTY_NEXT_50" },
  { symbol: "HAL.NS", name: "Hindustan Aeronautics", index: "NIFTY_NEXT_50" },
  { symbol: "HINDZINC.NS", name: "Hindustan Zinc", index: "NIFTY_NEXT_50" },
  { symbol: "HYUNDAI.NS", name: "Hyundai Motor India", index: "NIFTY_NEXT_50" },
  { symbol: "INDHOTEL.NS", name: "Indian Hotels Company", index: "NIFTY_NEXT_50" },
  { symbol: "IOC.NS", name: "Indian Oil Corporation", index: "NIFTY_NEXT_50" },
  { symbol: "IRFC.NS", name: "Indian Railway Finance Corporation", index: "NIFTY_NEXT_50" },
  { symbol: "JINDALSTEL.NS", name: "Jindal Steel & Power", index: "NIFTY_NEXT_50" },
  { symbol: "LODHA.NS", name: "Macrotech Developers (Lodha)", index: "NIFTY_NEXT_50" },
  { symbol: "LTM.NS", name: "LTM Limited (formerly LTIMindtree)", index: "NIFTY_NEXT_50" },
  { symbol: "MAZDOCK.NS", name: "Mazagon Dock Shipbuilders", index: "NIFTY_NEXT_50" },
  { symbol: "MUTHOOTFIN.NS", name: "Muthoot Finance", index: "NIFTY_NEXT_50" },
  { symbol: "PIDILITIND.NS", name: "Pidilite Industries", index: "NIFTY_NEXT_50" },
  { symbol: "PFC.NS", name: "Power Finance Corporation", index: "NIFTY_NEXT_50" },
  { symbol: "PNB.NS", name: "Punjab National Bank", index: "NIFTY_NEXT_50" },
  { symbol: "RECLTD.NS", name: "REC Limited", index: "NIFTY_NEXT_50" },
  { symbol: "MOTHERSON.NS", name: "Samvardhana Motherson International", index: "NIFTY_NEXT_50" },
  { symbol: "SHREECEM.NS", name: "Shree Cement", index: "NIFTY_NEXT_50" },
  { symbol: "SIEMENS.NS", name: "Siemens", index: "NIFTY_NEXT_50" },
  { symbol: "ENRIN.NS", name: "Siemens Energy India", index: "NIFTY_NEXT_50" },
  { symbol: "SOLARINDS.NS", name: "Solar Industries India", index: "NIFTY_NEXT_50" },
  { symbol: "TATACAP.NS", name: "Tata Capital", index: "NIFTY_NEXT_50" },
  { symbol: "TMCV.NS", name: "Tata Motors Commercial Vehicles", index: "NIFTY_NEXT_50" },
  { symbol: "TATAPOWER.NS", name: "Tata Power", index: "NIFTY_NEXT_50" },
  { symbol: "TORNTPHARM.NS", name: "Torrent Pharmaceuticals", index: "NIFTY_NEXT_50" },
  { symbol: "TVSMOTOR.NS", name: "TVS Motor Company", index: "NIFTY_NEXT_50" },
  { symbol: "UNIONBANK.NS", name: "Union Bank of India", index: "NIFTY_NEXT_50" },
  { symbol: "UNITDSPR.NS", name: "United Spirits", index: "NIFTY_NEXT_50" },
  { symbol: "VBL.NS", name: "Varun Beverages", index: "NIFTY_NEXT_50" },
  { symbol: "VEDL.NS", name: "Vedanta", index: "NIFTY_NEXT_50" },
  { symbol: "ZYDUSLIFE.NS", name: "Zydus Lifesciences", index: "NIFTY_NEXT_50" },
];
