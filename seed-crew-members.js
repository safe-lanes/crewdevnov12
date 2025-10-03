const fetch = require('node-fetch');

// Company Ranks from the system
const COMPANY_RANKS = [
  { rank: 'Master', rankId: 'S1' },
  { rank: 'Chief Officer', rankId: 'S2' },
  { rank: 'Chief Engineer', rankId: 'S7' },
  { rank: '2nd Officer', rankId: 'S3' },
  { rank: '3rd Officer', rankId: 'S4' },
  { rank: '2nd Engineer', rankId: 'S9' },
  { rank: '3rd Engineer', rankId: 'S10' },
  { rank: 'Bosun', rankId: 'S12' },
  { rank: 'AB', rankId: 'S14' },
  { rank: 'OS', rankId: 'S15' },
  { rank: '4th Engineer', rankId: 'S16' },
  { rank: 'Fitter', rankId: 'S17' },
  { rank: 'Oiler', rankId: 'S18' },
  { rank: 'Chief Cook', rankId: 'S19' },
  { rank: 'Messman', rankId: 'S20' },
  { rank: 'Electrical Officer', rankId: 'S21' },
  { rank: 'Pumpman', rankId: 'S21' },
];

// Maritime nationalities (common in shipping industry)
const NATIONALITIES = [
  'Filipino', 'Indian', 'Ukrainian', 'Russian', 'Polish', 
  'Romanian', 'Croatian', 'Bulgarian', 'Chinese', 'Indonesian',
  'Turkish', 'Greek', 'British', 'German', 'Norwegian',
  'Italian', 'Spanish', 'Vietnamese', 'Myanmar', 'Latvian'
];

// Vessel types
const VESSEL_TYPES = [
  'Oil Tanker', 'Chemical Tanker', 'LNG Carrier', 'Container Ship',
  'Bulk Carrier', 'General Cargo', 'Product Tanker', 'VLCC'
];

// Vessel names
const VESSEL_NAMES = [
  'MV Pacific Star', 'MV Atlantic Horizon', 'MV Northern Wind', 'MV Southern Cross',
  'MV Eastern Dawn', 'MV Western Pride', 'MV Ocean Navigator', 'MV Sea Explorer',
  'MV Global Trader', 'MV Maritime Express', 'MV Cargo Master', 'MV Swift Voyager',
  'MV Energy Carrier', 'MV Blue Ocean', 'MV Red Sea', 'MV Golden Wave'
];

// Status options
const STATUSES = ['Available', 'On Leave', 'Available', 'Available']; // More "Available" for better test data

// First names by nationality
const FIRST_NAMES = {
  Filipino: ['Jose', 'Juan', 'Pedro', 'Maria', 'Antonio', 'Roberto', 'Carlos', 'Miguel', 'Ramon', 'Eduardo', 'Fernando', 'Luis', 'Manuel', 'Angel', 'Ricardo'],
  Indian: ['Rajesh', 'Amit', 'Suresh', 'Vijay', 'Anil', 'Ramesh', 'Sandeep', 'Manoj', 'Deepak', 'Ravi', 'Ashok', 'Prakash', 'Sanjay', 'Kumar', 'Pankaj'],
  Ukrainian: ['Oleksandr', 'Volodymyr', 'Andriy', 'Petro', 'Sergiy', 'Ivan', 'Mykola', 'Vasyl', 'Yuriy', 'Dmytro', 'Taras', 'Viktor', 'Oleg', 'Maksym', 'Roman'],
  Russian: ['Aleksandr', 'Sergey', 'Dmitriy', 'Vladimir', 'Andrey', 'Mikhail', 'Nikolay', 'Yevgeniy', 'Igor', 'Pavel', 'Aleksey', 'Ivan', 'Oleg', 'Boris', 'Viktor'],
  Polish: ['Jan', 'Andrzej', 'Piotr', 'Krzysztof', 'Tomasz', 'Pawel', 'Michal', 'Marcin', 'Jakub', 'Adam', 'Wojciech', 'Marek', 'Lukasz', 'Kamil', 'Robert'],
  Romanian: ['Ion', 'Gheorghe', 'Nicolae', 'Vasile', 'Dumitru', 'Constantin', 'Stefan', 'Marian', 'Alexandru', 'Adrian', 'Florin', 'Cristian', 'Mihai', 'Daniel', 'Andrei'],
  Croatian: ['Ivan', 'Marko', 'Ante', 'Josip', 'Tomislav', 'Luka', 'Petar', 'Mario', 'Stjepan', 'Zvonimir', 'Damir', 'Branko', 'Zoran', 'Drago', 'Matej'],
  Bulgarian: ['Ivan', 'Georgi', 'Dimitar', 'Petar', 'Nikolay', 'Stefan', 'Hristo', 'Todor', 'Vasil', 'Stoyan', 'Boyan', 'Plamen', 'Rosen', 'Stanimir', 'Valentin'],
  Chinese: ['Wei', 'Chen', 'Li', 'Zhang', 'Wang', 'Liu', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu'],
  Indonesian: ['Ahmad', 'Budi', 'Agus', 'Andi', 'Eko', 'Hadi', 'Rudi', 'Yanto', 'Bambang', 'Dedi', 'Fajar', 'Hendra', 'Joko', 'Rizky', 'Samsul'],
  Turkish: ['Mehmet', 'Ahmet', 'Mustafa', 'Ali', 'Hasan', 'Huseyin', 'Ibrahim', 'Ismail', 'Osman', 'Omer', 'Yusuf', 'Recep', 'Emre', 'Kemal', 'Murat'],
  Greek: ['Nikolaos', 'Georgios', 'Dimitrios', 'Konstantinos', 'Ioannis', 'Panagiotis', 'Christos', 'Athanasios', 'Antonios', 'Vasileios', 'Spyridon', 'Andreas', 'Stavros', 'Michail', 'Alexandros'],
  British: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Andrew', 'Paul'],
  German: ['Hans', 'Peter', 'Klaus', 'Wolfgang', 'Jurgen', 'Helmut', 'Dieter', 'Manfred', 'Werner', 'Gunter', 'Horst', 'Heinz', 'Gerhard', 'Michael', 'Thomas'],
  Norwegian: ['Ole', 'Lars', 'Knut', 'Anders', 'Erik', 'Per', 'Jan', 'Hans', 'Bjorn', 'Svein', 'Geir', 'Arne', 'Tor', 'Rune', 'Morten'],
  Italian: ['Giuseppe', 'Antonio', 'Giovanni', 'Francesco', 'Mario', 'Luigi', 'Angelo', 'Vincenzo', 'Pietro', 'Salvatore', 'Carlo', 'Franco', 'Domenico', 'Bruno', 'Roberto'],
  Spanish: ['Antonio', 'Jose', 'Manuel', 'Francisco', 'Juan', 'David', 'Miguel', 'Carlos', 'Pedro', 'Luis', 'Javier', 'Rafael', 'Fernando', 'Sergio', 'Pablo'],
  Vietnamese: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Phan', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo', 'Duong', 'Ly', 'Mai', 'Trinh'],
  Myanmar: ['Aung', 'Kyaw', 'Than', 'Tin', 'Win', 'Myint', 'Htun', 'Zaw', 'Myo', 'Soe', 'Hlaing', 'Min', 'Nay', 'Thant', 'Htet'],
  Latvian: ['Janis', 'Andris', 'Juris', 'Aigars', 'Guntis', 'Valdis', 'Edgars', 'Martins', 'Uldis', 'Ivars', 'Roberts', 'Arturs', 'Raimonds', 'Oskars', 'Kristaps']
};

// Last names by nationality
const FAMILY_NAMES = {
  Filipino: ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Lopez', 'Gonzales', 'Rodriguez', 'Ramos', 'Flores', 'Rivera', 'Castro', 'Fernandez'],
  Indian: ['Sharma', 'Kumar', 'Singh', 'Patel', 'Gupta', 'Reddy', 'Nair', 'Verma', 'Rao', 'Pillai', 'Menon', 'Das', 'Joshi', 'Iyer', 'Naidu'],
  Ukrainian: ['Kovalenko', 'Shevchenko', 'Bondarenko', 'Tkachenko', 'Koval', 'Melnyk', 'Polishchuk', 'Bondar', 'Petrenko', 'Marchenko', 'Lysenko', 'Savchenko', 'Kravchenko', 'Rudenko', 'Pavlenko'],
  Russian: ['Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov', 'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Petrov', 'Volkov', 'Solovyov', 'Vasiliev', 'Zaytsev', 'Pavlov'],
  Polish: ['Nowak', 'Kowalski', 'Wisniewski', 'Wojcik', 'Kowalczyk', 'Kaminski', 'Lewandowski', 'Zielinski', 'Szymanski', 'Wozniak', 'Dabrowski', 'Kozlowski', 'Jankowski', 'Mazur', 'Krawczyk'],
  Romanian: ['Popescu', 'Ionescu', 'Popa', 'Stan', 'Dumitrescu', 'Stoica', 'Gheorghe', 'Constantinescu', 'Munteanu', 'Stanescu', 'Mocanu', 'Badea', 'Vlad', 'Dobre', 'Rusu'],
  Croatian: ['Horvat', 'Kovacevic', 'Babic', 'Novak', 'Maric', 'Juric', 'Petrovic', 'Pavlovic', 'Markovic', 'Knezevic', 'Tomic', 'Simic', 'Jankovic', 'Antic', 'Jovic'],
  Bulgarian: ['Ivanov', 'Petrov', 'Dimitrov', 'Georgiev', 'Hristov', 'Nikolov', 'Stoyanov', 'Iliev', 'Todorov', 'Vasilev', 'Angelov', 'Kolev', 'Stefanov', 'Marinov', 'Atanasov'],
  Chinese: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Ma', 'Zhu', 'Hu'],
  Indonesian: ['Santoso', 'Wijaya', 'Susanto', 'Kurniawan', 'Wibowo', 'Setiawan', 'Gunawan', 'Saputra', 'Pratama', 'Hidayat', 'Nugroho', 'Firmansyah', 'Hakim', 'Putra', 'Rahman'],
  Turkish: ['Yilmaz', 'Kaya', 'Demir', 'Sahin', 'Celik', 'Yildiz', 'Yildirim', 'Ozturk', 'Aydin', 'Ozdemir', 'Arslan', 'Dogan', 'Kilic', 'Aslan', 'Cetin'],
  Greek: ['Papadopoulos', 'Papadakis', 'Dimitriou', 'Georgiou', 'Konstantinou', 'Nikolaou', 'Ioannidis', 'Panagiotopoulos', 'Petrou', 'Christodoulou', 'Vasiliou', 'Angelopoulos', 'Athanasiadis', 'Michalopoulos', 'Kokkinos'],
  British: ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davies', 'Wilson', 'Evans', 'Thomas', 'Johnson', 'Roberts', 'Walker', 'Wright', 'Robinson', 'Thompson'],
  German: ['Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf'],
  Norwegian: ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen', 'Pedersen', 'Nilsen', 'Kristiansen', 'Jensen', 'Karlsen', 'Johnsen', 'Pettersen', 'Eriksen', 'Berg', 'Haugen'],
  Italian: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Costa'],
  Spanish: ['Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Cruz'],
  Vietnamese: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Phan', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo', 'Duong', 'Ly', 'Mai', 'Trinh'],
  Myanmar: ['Aung', 'Win', 'Kyaw', 'Hlaing', 'Myint', 'Than', 'Htun', 'Zaw', 'Soe', 'Myo', 'Thant', 'Min', 'Nay', 'Htet', 'Lwin'],
  Latvian: ['Berzins', 'Ozols', 'Kalejs', 'Liepa', 'Krumins', 'Eglitis', 'Petersons', 'Jansons', 'Circenis', 'Abolins', 'Vitols', 'Lacis', 'Ziemelis', 'Strautmanis', 'Paegle']
};

// Airports by nationality/region
const AIRPORTS = {
  Filipino: ['Manila', 'Cebu', 'Davao', 'Clark'],
  Indian: ['Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Kochi'],
  Ukrainian: ['Kyiv', 'Odesa', 'Lviv'],
  Russian: ['Moscow', 'St Petersburg', 'Vladivostok', 'Novorossiysk'],
  Polish: ['Warsaw', 'Gdansk', 'Krakow'],
  Romanian: ['Bucharest', 'Constanta'],
  Croatian: ['Zagreb', 'Split', 'Dubrovnik'],
  Bulgarian: ['Sofia', 'Varna', 'Burgas'],
  Chinese: ['Shanghai', 'Hong Kong', 'Guangzhou', 'Dalian'],
  Indonesian: ['Jakarta', 'Surabaya', 'Batam'],
  Turkish: ['Istanbul', 'Izmir', 'Ankara'],
  Greek: ['Athens', 'Piraeus', 'Thessaloniki'],
  British: ['London', 'Southampton', 'Glasgow'],
  German: ['Hamburg', 'Bremen', 'Frankfurt'],
  Norwegian: ['Oslo', 'Bergen', 'Stavanger'],
  Italian: ['Genoa', 'Naples', 'Rome'],
  Spanish: ['Barcelona', 'Valencia', 'Bilbao'],
  Vietnamese: ['Ho Chi Minh', 'Hanoi', 'Da Nang'],
  Myanmar: ['Yangon', 'Mandalay'],
  Latvian: ['Riga', 'Ventspils']
};

// Helper functions
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function calculateAge(dob) {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Get age range based on rank
function getAgeRange(rank) {
  if (rank.includes('Master') || rank.includes('Chief')) return { min: 45, max: 60 };
  if (rank.includes('2nd Officer') || rank.includes('2nd Engineer')) return { min: 35, max: 50 };
  if (rank.includes('3rd Officer') || rank.includes('3rd Engineer')) return { min: 28, max: 42 };
  if (rank.includes('4th Engineer')) return { min: 26, max: 38 };
  if (rank.includes('Electrical Officer')) return { min: 32, max: 48 };
  if (rank.includes('Bosun') || rank.includes('Fitter') || rank.includes('Pumpman')) return { min: 35, max: 55 };
  if (rank.includes('AB') || rank.includes('OS') || rank.includes('Oiler')) return { min: 25, max: 50 };
  if (rank.includes('Chief Cook')) return { min: 30, max: 50 };
  if (rank.includes('Messman')) return { min: 22, max: 45 };
  return { min: 25, max: 50 };
}

// Get experience level based on rank
function getExperienceYears(rank) {
  if (rank.includes('Master') || rank.includes('Chief')) return randomInt(20, 35);
  if (rank.includes('2nd')) return randomInt(10, 20);
  if (rank.includes('3rd')) return randomInt(5, 12);
  if (rank.includes('4th')) return randomInt(3, 8);
  if (rank.includes('Bosun') || rank.includes('Fitter') || rank.includes('Pumpman')) return randomInt(8, 20);
  if (rank.includes('AB')) return randomInt(5, 15);
  if (rank.includes('OS') || rank.includes('Oiler')) return randomInt(2, 10);
  if (rank.includes('Cook')) return randomInt(8, 20);
  if (rank.includes('Messman')) return randomInt(1, 8);
  return randomInt(3, 15);
}

// Generate a crew member
function generateCrewMember(rank, rankId, index) {
  const nationality = randomItem(NATIONALITIES);
  const firstName = randomItem(FIRST_NAMES[nationality] || FIRST_NAMES.British);
  const familyName = randomItem(FAMILY_NAMES[nationality] || FAMILY_NAMES.British);
  const vesselType = randomItem(VESSEL_TYPES);
  const presentVessel = randomItem(VESSEL_NAMES);
  const status = randomItem(STATUSES);
  
  // Generate realistic DOB based on rank
  const ageRange = getAgeRange(rank);
  const age = randomInt(ageRange.min, ageRange.max);
  const birthYear = new Date().getFullYear() - age;
  const birthMonth = randomInt(1, 12);
  const birthDay = randomInt(1, 28);
  const dateOfBirth = formatDate(birthYear, birthMonth, birthDay);
  
  // Email and contact
  const email = `${firstName.toLowerCase()}.${familyName.toLowerCase()}@seafarer.com`;
  const mobile = `+${randomInt(1, 99)}-${randomInt(100, 999)}-${randomInt(1000000, 9999999)}`;
  
  // Location
  const airportOptions = AIRPORTS[nationality] || AIRPORTS.British;
  const nearestAirport = randomItem(airportOptions);
  
  // Contract details
  const contractPeriods = ['6 months', '9 months', '12 months', '4+2 months', '6+1 months'];
  const contractPeriod = randomItem(contractPeriods);
  
  // Joining date (within last 6 months to 2 years)
  const daysAgo = randomInt(180, 730);
  const joiningDate = new Date();
  joiningDate.setDate(joiningDate.getDate() - daysAgo);
  const joiningDateStr = formatDate(joiningDate.getFullYear(), joiningDate.getMonth() + 1, joiningDate.getDate());
  
  // Physical characteristics
  const heightCm = randomInt(160, 190);
  const weightKg = randomInt(60, 95);
  const bmi = (weightKg / ((heightCm / 100) ** 2)).toFixed(1);
  
  const maritalStatuses = ['Single', 'Married', 'Married', 'Married']; // More married
  const maritalStatus = randomItem(maritalStatuses);
  
  return {
    id: `CREW${Date.now()}${randomInt(1000, 9999)}`,
    firstName: firstName,
    familyName: familyName,
    presentRank: rank,
    nationality: nationality,
    vesselType: vesselType,
    presentVessel: presentVessel,
    status: status,
    dateOfBirth: dateOfBirth,
    age: age.toString(),
    email: email,
    mobile: mobile,
    nearestAirport: nearestAirport,
    countryOfResidence: nationality,
    joiningDate: joiningDateStr,
    contractPeriod: contractPeriod,
    heightCm: heightCm.toString(),
    weightKg: weightKg.toString(),
    bmi: bmi,
    maritalStatus: maritalStatus,
    englishProficiency: randomItem(['Fluent', 'Good', 'Fair', 'Excellent']),
    nativeLanguage: nationality,
  };
}

// Main seeding function
async function seedCrewMembers() {
  console.log('🌱 Starting crew member seeding...\n');
  
  let totalCreated = 0;
  let errors = 0;
  
  for (const { rank, rankId } of COMPANY_RANKS) {
    // Determine how many to create for this rank
    const count = (rank === 'AB' || rank === 'OS' || rank === 'Oiler') ? 15 : 6;
    
    console.log(`📋 Creating ${count} crew members for rank: ${rank}`);
    
    for (let i = 0; i < count; i++) {
      const crewMember = generateCrewMember(rank, rankId, i);
      
      try {
        const response = await fetch('http://localhost:5000/api/crew-members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(crewMember),
        });
        
        if (response.ok) {
          totalCreated++;
          process.stdout.write('.');
        } else {
          const errorText = await response.text();
          console.error(`\n❌ Failed to create crew member: ${errorText}`);
          errors++;
        }
      } catch (error) {
        console.error(`\n❌ Error creating crew member: ${error.message}`);
        errors++;
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(` ✓ Completed ${rank}`);
  }
  
  console.log(`\n\n✅ Seeding complete!`);
  console.log(`📊 Total crew members created: ${totalCreated}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`\n💾 All data saved to test-data.json`);
}

// Run the seeder
seedCrewMembers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
