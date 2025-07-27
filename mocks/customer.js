const companyList = [
  {
    name: "GEAR WORLD",
    address: "PLOT NO.1, 1ST FLOOR, SURVEY NO.39 AP/41 P, BEHIND REAL PLAZA, 8 A NATIONAL HIGHWAY, LALPAR, MORBI, GUJARAT- 363642",
    gst_no: "24AAUFG2453K1Z2",
    user_name:"gear_world",
    password:"customer123",
    phone:"9657965727",
    role:"CUSTOMER"
  },
  {
    name: "KAPOOR SONS CORPORATION",
    address: "OPP SARANG TALIKES, SARANG ROAD, SONIPAT, HARYANA-131001",
    gst_no: "06AYAPK5179Q1ZT",
    user_name:"ks_corp",
    password:"customer123",
    role:"CUSTOMER"    
  },
  {
    name: "V S INDUSTRIES",
    address: "D-155, MAYAPURI, INDL.AREA, PHASE-II, NEW DELHI-110064",
    gst_no: "07AARFV1129N1ZL",
    user_name:"vs_industries",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "KSR ENGINEERS",
    address: "PLOT NO.30, INDUSTRIAL AREA, VILLAGE-BHAGWANPUR, VIA. JAI PARVATI FORGE LTD ROAD DERABASSI-140507",
    gst_no: "03ACNPS9173M1ZT",
    user_name:"ksr_engineers",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "LAXMI TRANSMISSION",
    address: "54 NAGARWEL IND. ESTATE, NR.NAGARWEL HANUMAN TEMPLE ROAD, OPP.AMRAIWADI SBI BANK, RAKHIAL, GUJARAT, AHMEDABAD-380023",
    gst_no: "24AAEFL6739M1ZW",
    user_name:"laxmi_transmission",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "APEKSHA ENTERPRISES",
    address: "MSA-518, NEW SIYAGANJ, INDORE. (MP) 422007",
    gst_no: "23BBGPM2585Q1Z3",
    user_name:"apeksha_enterprises",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "KIRTI ENTERPRISES",
    address: "157 KANCHAN BAGH, INDORE Madhya Pradesh- 452001",
    gst_no: "23AFBPS4604Q1Z7",
    user_name:"kirti_enterprises",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "ATTENTIVE ENGINEERING AND SERVICES",
    address: "NO.26A, 1ST MAIN ROAD,1ST CROSS, VINAYAKANAGARA MAIN ROAD, OPP.KENNEMETAL VIDEA, TUMKUR ROAD, NAGASANDRA POST, BANGALORE. Karnataka - 560073",
    gst_no: "29AIHPA6657J1ZX",
    user_name:"attentive_engineering",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "ELMECH POWER TRANSMISSION",
    address: "SH-3 BLH RAJYOG TOWN SHIP SN-26/4,31/23 WADGAON KH PUNE 411041",
    gst_no: "27COHPC2334G1ZA",
    user_name:"ep_transmission",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "GREENFLOW TECHNOLOGY",
    address: "D12, ABOLI BUILDING, TIRUPATI PARK, NEAR N-4, CIDCO, AURANGABAD",
    gst_no: "27ARLPP7078H1Z4",
    user_name:"greenflow_technology",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "GROWWELL ENGITECH PRIVATE LIMITED",
    address: "37, SAROVAR ESTATE, NR HATHIJAN CIRCLE VATVA, AHMEDABAD, GUJARAT- 382445",
    gst_no: "24AAJCG7307E1ZT",
    user_name:"ge_pvt_ltd",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "INDIA ELECTRIC WORKS",
    address: "PADAM BHAWAN, STATION ROAD, OPP.HDFC BANK, JAIPUR, Rajasthan -302006",
    gst_no: "08ABSPB7104K1ZI",
    user_name:"india_electric",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "KAPI ENTERPRISES",
    address: "PLOT NO.20, BALAJI INDL.AREA, NEAR RLY.CROSSING, KOTHARIA, RAJKOT-360002",
    gst_no: "24AHJPD3173B1ZX",
    user_name:"kapi_enterprises",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "MAHAVIR BEARING CORPORATION",
    address: "OPP.SONAL APT, SONAWALA ACROSS ROAD NO.1, GOREGAON E, Maharashtra - 400063",
    gst_no: "27AABPD4746P1ZF",
    user_name:"mb_corporation",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "CONCORD GEARS & MOTORS",
    address: "3F-16, THIRD FLOOR, MAHIMA TRINTY MALL, SWEZ FARM, NEW SANGANER ROAD, PLOT NO.5, SODALA, JAIPUR, Rajasthan -302019",
    gst_no: "08ACMPA7546B1ZS",
    user_name:"concord_gm",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "NEXA ENGINEERING SOLUTIONS",
    address: "SR.NO.45/1/4A, JAMBHULWADI ROAD, INDRAYANI NAGAR, DATTANAGAR, AMBEGAON-BK, PUNE-411046",
    gst_no: "27BEPPD7667Q1ZG",
    user_name:"ne_solutions",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "NUTECH TRANSMISSIONS",
    address: "PLOT NO.158, HANSA INDUSTRIAL PARK, BARWALA ROAD, DERABASSI (PB)-140507",
    gst_no: "03AAKFN0647E1ZM",
    user_name:"nutech_transmissions",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "POWERTEK EQUIPMENT CO.",
    address: "121- CENTURA SQUARE OPP. LANXESS HOUSE, ROAD NO 27, WAGLE INDUSTRIAL ESTATE, THANE (WEST), MUMBAI-400604",
    gst_no: "27AAAPH5814P1ZH",
    user_name:"pe_corporation",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "PRADEEP AGENCIES",
    address: "SHOP NO.5 MANIHAR COMPLEX, RAMSAGAR PARA RAIPUR, CHHATTSGARH-492001",
    gst_no: "22BALPS7036Q1Z0",
    user_name:"pradeep_agencies",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "PREMIER MACHINERY STORE",
    address: "RAILWAY ROAD, SAHARANPUR, UP -247001",
    gst_no: "09AAFFP0412J1ZF",
    user_name:"pm_store",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "QUEST BEARING AND GEAR",
    address: "OLD-154, NEW -319, THAMBU CHETTY, STREET FACING, LINGHI CHETTY STREET, NEAR SHAW WALLANCE BUILDING, CHENNAI Tamil Nadu -600001",
    gst_no: "33BDFPA8605Q1ZE",
    user_name:"qb_gear",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "RITIK ENGINEERING WORKS",
    address: "296 BASEMENT NEW BJ MARKET, JALGAON, MAHARASHTRA-425001",
    gst_no: "27AFZPK5801R1ZG",
    user_name:"re_works",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "R V TRADING CORPORATION",
    address: "REG.OFFICE.NO.69/66, BAKERS STREET, CHOOLAI, CHENNAI-600112",
    gst_no: "33BIUPP3527N1ZK",
    user_name:"rvt_corporation",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "SHREYASH ENGINEERING",
    address: "221/ A OLD GOODSSHED ROAD, NEAR OVERBRIDGE, BELAGAVI Karnataka 590014",
    gst_no: "29ADUPA3361P1ZW",
    user_name:"shreyash_engineering",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "SHREE TRANSMISSION",
    address: "X-280, SHOP NO.23, OSWAL MARKET, WALUJ MIDC, AURANGABAD",
    gst_no: "27ACHFS6641L1ZL",
    user_name:"shree_transmission",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "SRI VMD SOLUTIONS",
    address: "34, 5TH CROSS, RR LAYOUT, NEAR ACHARYA B SCHOOL, VIDYAMANYANAGAR (WEST), ANDHRALLI ROAD, BANGALURU, Karnataka-560091",
    gst_no: "29CKKPB8366E1ZW",
    user_name:"sri_vmd_solutions",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "SSS EURO ENGINEERS",
    address: "AMBIKA GIRI ROY CHOUDHARY ROAD, WARD NO.15, P.O-HIJUGURI (786192), P.S, DIST-TINSUKIA, ASSAM- 786192",
    gst_no: "18AMPPJ5654C1ZV",
    user_name:"sss_engineers",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "VASHU ELECTRICAL",
    address: "N.H.NO.287, GALI NO.1, KANIKA VIHAR, KARNAL, Haryana -132001",
    gst_no: "06ARFPK1333A1ZJ",
    user_name:"vashu_electrical",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "SWASTIK ENGINEERING",
    address: "518, 5TH FLOOR, AMBER TOWER, COMMERCIAL COMPLEX, AZADPUR, DELHI-110033",
    gst_no: "07BYJPS6203H3Z7",
    user_name:"swastik_engineering",
    password:"customer123",
    role:"CUSTOMER"
  },
  {
    name: "VARIATION ELECTRIC COMPANY PVT LTD",
    address: "PLOT NO.31, KARKHANA BAGH, 16/2 MATHURA ROAD, FARIDABAD, Haryana-121002",
    gst_no: "06AABCV3750C1ZP",
    user_name:"ve_pvt_ltd",
    password:"customer123",
    role:"CUSTOMER"
  }
];
export default companyList;