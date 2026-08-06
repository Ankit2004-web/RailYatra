/**
 * Map Wikipedia station / city names to IR station codes using DB + common aliases.
 */
const { normalizeCode, normalizeName } = require('./normalizers');

const STATION_ALIASES = Object.freeze({
    'ahmedabad': 'ADI',
    'howrah': 'HWH',
    'howrah jn': 'HWH',
    'kolkata': 'KOAA',
    'mumbai csmt': 'CSMT',
    'mumbai cst': 'CSMT',
    'chhatrapati shivaji maharaj terminus': 'CSMT',
    'new delhi': 'NDLS',
    'delhi': 'NDLS',
    'hazrat nizamuddin': 'NZM',
    'anand vihar terminal': 'ANVT',
    'anand vihar': 'ANVT',
    'bengaluru': 'SBC',
    'bangalore city': 'SBC',
    'bangalore': 'SBC',
    'yesvantpur': 'YPR',
    'chennai central': 'MAS',
    'chennai': 'MAS',
    'madras': 'MAS',
    'hyderabad': 'HYB',
    'secunderabad': 'SC',
    'bhubaneswar': 'BBS',
    'bhubaneshwar': 'BBS',
    'puri': 'PURI',
    'jaipur': 'JP',
    'jodhpur': 'JU',
    'bikaner': 'BKN',
    'ajmer': 'AII',
    'amritsar': 'ASR',
    'jammu tawi': 'JAT',
    'jammu': 'JAT',
    'chandigarh': 'CDG',
    'lucknow': 'LKO',
    'kanpur central': 'CNB',
    'kanpur': 'CNB',
    'allahabad': 'PRYJ',
    'prayagraj': 'PRYJ',
    'varanasi': 'BSB',
    'patna': 'PNBE',
    'patna jn': 'PNBE',
    'guwahati': 'GHY',
    'kamakhya': 'KYQ',
    'silchar': 'SCL',
    'dibrugarh': 'DBRG',
    'ranchi': 'RNC',
    'bhopal': 'BPL',
    'indore': 'INDB',
    'nagpur': 'NGP',
    'pune': 'PUNE',
    'surat': 'ST',
    'vadodara': 'BRC',
    'rajkot': 'RJT',
    'gandhinagar capital': 'GNC',
    'gandhinagar': 'GNC',
    'coimbatore': 'CBE',
    'madurai': 'MDU',
    'tiruchirappalli': 'TPJ',
    'trichy': 'TPJ',
    'thiruvananthapuram central': 'TVC',
    'trivandrum central': 'TVC',
    'kochi': 'ERS',
    'ernakulam': 'ERS',
    'kozhikode': 'CLT',
    'mangalore central': 'MAQ',
    'hubli': 'UBL',
    'mysuru': 'MYS',
    'mysore': 'MYS',
    'vijayawada': 'BZA',
    'visakhapatnam': 'VSKP',
    'vizag': 'VSKP',
    'warangal': 'WL',
    'nizamabad': 'NZB',
    'aurangabad': 'AWB',
    'nanded': 'NED',
    'hazur sahib nanded': 'NED',
    'solapur': 'SUR',
    'kolhapur': 'KOP',
    'goa': 'MAO',
    'madgaon': 'MAO',
    'jabalpur': 'JBP',
    'gwalior': 'GWL',
    'jammu tawi': 'JAT',
    'dehradun': 'DDN',
    'haridwar': 'HW',
    'rishikesh': 'RKSH',
    'bareilly': 'BE',
    'moradabad': 'MB',
    'gorakhpur': 'GKP',
    'mughalsarai': 'BSB',
    'pt.deen dayal upadhyaya jn': 'DDU',
    'asansol': 'ASN',
    'durgapur': 'DGR',
    'siliguri': 'SGUJ',
    'new jalpaiguri': 'NJP',
    'darjeeling': 'DJ',
    'agartala': 'AGTL',
    'imphal': 'IMPH',
    'dibrugarh town': 'DBRT',
    'lalitpur': 'LAR',
    'bandra terminus': 'BDTS',
    'lokmanya tilak terminus': 'LTT',
    'panvel': 'PNVL',
    'vapi': 'VAPI',
    'bhavnagar terminus': 'BVT',
    'bhagat ki kothi': 'BGKT',
    'udaipur city': 'UDZ',
    'udaipur': 'UDZ',
    'jodhpur': 'JU',
    'abohar': 'ABS',
    'bathinda': 'BTI',
    'bhiwani': 'BNW',
    'kalka': 'KLK',
    'smvt bengaluru': 'SMVB',
    'krishnarajapuram': 'KJM',
    'smvt bangalore': 'SMVB'
});

function aliasKey(name) {
    return normalizeName(name).toLowerCase();
}

function buildStationLookup(stations) {
    const byCode = new Map();
    const byName = new Map();
    const byAlias = new Map(Object.entries(STATION_ALIASES));

    for (const station of stations) {
        const code = normalizeCode(station.code);
        if (!code) continue;
        byCode.set(code, station);
        byName.set(aliasKey(station.name), station);
        if (station.city) byName.set(aliasKey(station.city), station);
    }

    return { byCode, byName, byAlias };
}

function resolveStationName(name, lookup) {
    if (!name) return null;
    const key = aliasKey(name);

    if (lookup.byAlias.has(key)) {
        const code = lookup.byAlias.get(key);
        return lookup.byCode.get(code) || null;
    }

    if (lookup.byName.has(key)) {
        return lookup.byName.get(key);
    }

    // Partial match: "Bhubaneswar" in "Bhubaneswar New Delhi"
    for (const [stationKey, station] of lookup.byName.entries()) {
        if (key.includes(stationKey) || stationKey.includes(key)) {
            if (Math.min(key.length, stationKey.length) >= 5) return station;
        }
    }

    for (const [alias, code] of lookup.byAlias.entries()) {
        if (key.includes(alias) || alias.includes(key)) {
            if (Math.min(key.length, alias.length) >= 5) {
                return lookup.byCode.get(code) || null;
            }
        }
    }

    return null;
}

module.exports = {
    STATION_ALIASES,
    buildStationLookup,
    resolveStationName
};
