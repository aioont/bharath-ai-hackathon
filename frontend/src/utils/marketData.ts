// AgMarkNet API Data Structures

export interface Commodity {
  cmdt_id: number
  cmdt_name: string
  cmdt_group_id: number
}

export interface State {
  state_id: number
  state_name: string
}

export const COMMODITIES: Commodity[] = [
  { cmdt_id: 1, cmdt_name: "Wheat", cmdt_group_id: 1 },
  { cmdt_id: 3, cmdt_name: "Rice", cmdt_group_id: 1 },
  { cmdt_id: 4, cmdt_name: "Maize", cmdt_group_id: 1 },
  { cmdt_id: 23, cmdt_name: "Onion", cmdt_group_id: 6 },
  { cmdt_id: 65, cmdt_name: "Tomato", cmdt_group_id: 6 },
  { cmdt_id: 24, cmdt_name: "Potato", cmdt_group_id: 6 },
  { cmdt_id: 13, cmdt_name: "Soyabean", cmdt_group_id: 3 },
  { cmdt_id: 15, cmdt_name: "Cotton", cmdt_group_id: 4 },
  { cmdt_id: 10, cmdt_name: "Groundnut", cmdt_group_id: 3 },
  { cmdt_id: 12, cmdt_name: "Mustard", cmdt_group_id: 3 },
  { cmdt_id: 26, cmdt_name: "Chili Red", cmdt_group_id: 7 },
  { cmdt_id: 35, cmdt_name: "Turmeric", cmdt_group_id: 7 },
  { cmdt_id: 6, cmdt_name: "Bengal Gram(Gram)(Whole)", cmdt_group_id: 2 },
  { cmdt_id: 45, cmdt_name: "Arhar(Tur/Red Gram)(Whole)", cmdt_group_id: 2 },
  { cmdt_id: 9, cmdt_name: "Green Gram(Moong)(Whole)", cmdt_group_id: 2 },
  { cmdt_id: 8, cmdt_name: "Black Gram(Urd Beans)(Whole)", cmdt_group_id: 2 },
  { cmdt_id: 20, cmdt_name: "Mango", cmdt_group_id: 5 },
  { cmdt_id: 19, cmdt_name: "Banana", cmdt_group_id: 5 },
  { cmdt_id: 22, cmdt_name: "Grapes", cmdt_group_id: 5 },
  { cmdt_id: 17, cmdt_name: "Apple", cmdt_group_id: 5 },
  { cmdt_id: 18, cmdt_name: "Orange", cmdt_group_id: 5 },
  { cmdt_id: 25, cmdt_name: "Garlic", cmdt_group_id: 6 },
  { cmdt_id: 27, cmdt_name: "Ginger(Dry)", cmdt_group_id: 7 },
  { cmdt_id: 87, cmdt_name: "Ginger(Green)", cmdt_group_id: 6 },
  { cmdt_id: 34, cmdt_name: "Black pepper", cmdt_group_id: 7 },
  { cmdt_id: 36, cmdt_name: "Cardamoms", cmdt_group_id: 7 },
  { cmdt_id: 28, cmdt_name: "Bajra(Pearl Millet/Cumbu)", cmdt_group_id: 1 },
  { cmdt_id: 5, cmdt_name: "Jowar(Sorghum)", cmdt_group_id: 1 },
  { cmdt_id: 30, cmdt_name: "Ragi(Finger Millet)", cmdt_group_id: 1 },
  { cmdt_id: 31, cmdt_name: "Cauliflower", cmdt_group_id: 6 },
  { cmdt_id: 32, cmdt_name: "Brinjal", cmdt_group_id: 6 },
  { cmdt_id: 71, cmdt_name: "Bhindi(Ladies Finger)", cmdt_group_id: 6 },
  { cmdt_id: 126, cmdt_name: "Cabbage", cmdt_group_id: 6 },
  { cmdt_id: 125, cmdt_name: "Carrot", cmdt_group_id: 6 },
  { cmdt_id: 73, cmdt_name: "Green Chilli", cmdt_group_id: 6 },
  { cmdt_id: 116, cmdt_name: "Coconut", cmdt_group_id: 7 },
  { cmdt_id: 122, cmdt_name: "Sugarcane", cmdt_group_id: 10 },
  { cmdt_id: 40, cmdt_name: "Tea", cmdt_group_id: 9 },
  { cmdt_id: 41, cmdt_name: "Coffee", cmdt_group_id: 9 },
  { cmdt_id: 14, cmdt_name: "Sunflower", cmdt_group_id: 3 },
]

export const STATES: State[] = [
  { state_id: 100000, state_name: "All States" },
  { state_id: 1, state_name: "Andaman and Nicobar" },
  { state_id: 2, state_name: "Andhra Pradesh" },
  { state_id: 3, state_name: "Arunachal Pradesh" },
  { state_id: 4, state_name: "Assam" },
  { state_id: 5, state_name: "Bihar" },
  { state_id: 6, state_name: "Chandigarh" },
  { state_id: 7, state_name: "Chattisgarh" },
  { state_id: 8, state_name: "Dadra and Nagar Haveli" },
  { state_id: 9, state_name: "Daman and Diu" },
  { state_id: 10, state_name: "Goa" },
  { state_id: 11, state_name: "Gujarat" },
  { state_id: 12, state_name: "Haryana" },
  { state_id: 13, state_name: "Himachal Pradesh" },
  { state_id: 14, state_name: "Jammu and Kashmir" },
  { state_id: 15, state_name: "Jharkhand" },
  { state_id: 16, state_name: "Karnataka" },
  { state_id: 17, state_name: "Kerala" },
  { state_id: 18, state_name: "Lakshadweep" },
  { state_id: 19, state_name: "Madhya Pradesh" },
  { state_id: 20, state_name: "Maharashtra" },
  { state_id: 21, state_name: "Manipur" },
  { state_id: 22, state_name: "Meghalaya" },
  { state_id: 23, state_name: "Mizoram" },
  { state_id: 24, state_name: "Nagaland" },
  { state_id: 25, state_name: "NCT of Delhi" },
  { state_id: 26, state_name: "Odisha" },
  { state_id: 27, state_name: "Pondicherry" },
  { state_id: 28, state_name: "Punjab" },
  { state_id: 29, state_name: "Rajasthan" },
  { state_id: 30, state_name: "Sikkim" },
  { state_id: 31, state_name: "Tamil Nadu" },
  { state_id: 32, state_name: "Telangana" },
  { state_id: 33, state_name: "Tripura" },
  { state_id: 34, state_name: "Uttar Pradesh" },
  { state_id: 35, state_name: "Uttarakhand" },
  { state_id: 36, state_name: "West Bengal" },
]

// Helper functions
export const getCommodityById = (id: number) => COMMODITIES.find(c => c.cmdt_id === id)
export const getStateById = (id: number) => STATES.find(s => s.state_id === id)
export const getCommodityByName = (name: string) => COMMODITIES.find(c => c.cmdt_name.toLowerCase() === name.toLowerCase())
export const getStateByName = (name: string) => STATES.find(s => s.state_name.toLowerCase() === name.toLowerCase())
