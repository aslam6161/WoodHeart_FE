/**
 * The eight divisions of Bangladesh and the sixty-four districts under them.
 *
 * A static list rather than an API call, and English rather than Bangla, for
 * one reason that matters more than either: the API decides the delivery zone
 * by comparing the district to the word "Dhaka". A district typed as "ঢাকা"
 * or "dhaka city" is priced as outside Dhaka, and the customer finds out in
 * the delivery line. Two selects make that impossible — every value here is
 * the spelling the API expects.
 *
 * Spellings follow the government's current romanisation (Chattogram, Barishal,
 * Cumilla, Jashore, Bogura). Only "Dhaka" carries meaning on the API side; the
 * rest are stored as typed and read back by a rider.
 */
export interface Division {
  name: string;
  districts: string[];
}

export const DIVISIONS: readonly Division[] = [
  {
    name: 'Dhaka',
    districts: [
      'Dhaka',
      'Faridpur',
      'Gazipur',
      'Gopalganj',
      'Kishoreganj',
      'Madaripur',
      'Manikganj',
      'Munshiganj',
      'Narayanganj',
      'Narsingdi',
      'Rajbari',
      'Shariatpur',
      'Tangail'
    ]
  },
  {
    name: 'Chattogram',
    districts: [
      'Bandarban',
      'Brahmanbaria',
      'Chandpur',
      'Chattogram',
      "Cox's Bazar",
      'Cumilla',
      'Feni',
      'Khagrachhari',
      'Lakshmipur',
      'Noakhali',
      'Rangamati'
    ]
  },
  {
    name: 'Rajshahi',
    districts: [
      'Bogura',
      'Chapainawabganj',
      'Joypurhat',
      'Naogaon',
      'Natore',
      'Pabna',
      'Rajshahi',
      'Sirajganj'
    ]
  },
  {
    name: 'Khulna',
    districts: [
      'Bagerhat',
      'Chuadanga',
      'Jashore',
      'Jhenaidah',
      'Khulna',
      'Kushtia',
      'Magura',
      'Meherpur',
      'Narail',
      'Satkhira'
    ]
  },
  {
    name: 'Barishal',
    districts: ['Barguna', 'Barishal', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur']
  },
  {
    name: 'Sylhet',
    districts: ['Habiganj', 'Moulvibazar', 'Sunamganj', 'Sylhet']
  },
  {
    name: 'Rangpur',
    districts: [
      'Dinajpur',
      'Gaibandha',
      'Kurigram',
      'Lalmonirhat',
      'Nilphamari',
      'Panchagarh',
      'Rangpur',
      'Thakurgaon'
    ]
  },
  {
    name: 'Mymensingh',
    districts: ['Jamalpur', 'Mymensingh', 'Netrokona', 'Sherpur']
  }
];

/** The districts of one division, or none for a division that does not exist. */
export function districtsOf(division: string | null | undefined): readonly string[] {
  return DIVISIONS.find(d => d.name === division)?.districts ?? [];
}
