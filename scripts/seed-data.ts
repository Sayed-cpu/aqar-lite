import type { Halalas } from "@/lib/money";
import type { Role } from "@/lib/roles";
import type { UnitType } from "@/lib/units";

/** Demo data for evaluation only — documented in the README. */
export const DEMO_PASSWORD = "Aqar@2026!";

export type SeedUnit = {
  project: string;
  number: string;
  type: UnitType;
  areaSqm: string;
  rooms: number;
  priceHalalas: Halalas;
};

export type SeedClient = { name: string; phone: string; notes: string };

type SeedUser = { email: string; name: string; role: Role; clients?: SeedClient[] };

/**
 * One project's units, numbered in order, with area and price stepping up
 * from a base. Prices are exact halalas, some with a fractional riyal, so the
 * list's sort and filters have real money to work on.
 */
function project(
  name: string,
  rows: readonly (readonly [number: string, type: UnitType, rooms: number])[],
  area: { from: number; step: number },
  price: { from: Halalas; step: Halalas },
): SeedUnit[] {
  return rows.map(([number, type, rooms], i) => ({
    project: name,
    number,
    type,
    rooms,
    areaSqm: (area.from + i * area.step).toFixed(2),
    priceHalalas: price.from + BigInt(i) * price.step,
  }));
}

const SAR = 100n;

export const SEED: { company: string; users: SeedUser[]; units: SeedUnit[] }[] = [
  {
    company: "شركة الأفق للتطوير العقاري",
    users: [
      { email: "manager@ofuq.test", name: "خالد العتيبي", role: "manager" },
      { email: "accountant@ofuq.test", name: "سارة القحطاني", role: "accountant" },
      {
        email: "rep1@ofuq.test",
        name: "فهد الشمري",
        role: "sales_rep",
        clients: [
          {
            name: "محمد السالم",
            phone: "0551234501",
            // Markup on purpose: the client page must show it as text.
            notes: 'يبحث عن شقة بثلاث غرف قريبة من المدارس.\nنص تجريبي: <script>alert("xss")</script> يجب أن يظهر كما هو.',
          },
          { name: "عبدالرحمن الغامدي", phone: "0551234502", notes: "يفضّل التواصل بعد المغرب." },
          { name: "لطيفة العنزي", phone: "0551234503", notes: "مهتمة بفلل الياسمين، ميزانية حتى 2.5 مليون." },
          { name: "سلطان البقمي", phone: "0551234504", notes: "" },
          { name: "منيرة الشهري", phone: "+966551234505", notes: "تريد دفعة أولى منخفضة وأقساطًا على 5 سنوات." },
        ],
      },
      {
        email: "rep2@ofuq.test",
        name: "نورة الدوسري",
        role: "sales_rep",
        clients: [
          { name: "تركي المالكي", phone: "0561234501", notes: "مستثمر، يبحث عن محلات تجارية." },
          { name: "أمل الحربي", phone: "0561234502", notes: "زارت أبراج الأفق مرتين." },
          { name: "يوسف الزهراني", phone: "0561234503", notes: "" },
          // The same person as one of rep1's clients: two reps may both know them.
          { name: "محمد السالم", phone: "0551234501", notes: "تواصل معي مباشرة عبر الموقع." },
        ],
      },
    ],
    units: [
      ...project(
        "أبراج الأفق",
        [
          ["A-101", "apartment", 2],
          ["A-102", "apartment", 2],
          ["A-201", "apartment", 3],
          ["A-202", "apartment", 3],
          ["B-301", "apartment", 3],
          ["B-302", "apartment", 4],
          ["B-401", "duplex", 4],
          ["B-402", "duplex", 5],
        ],
        { from: 95.5, step: 14.25 },
        { from: 650_000n * SAR, step: 72_500n * SAR + 50n },
      ),
      ...project(
        "فلل الياسمين",
        [
          ["V-01", "villa", 5],
          ["V-02", "villa", 5],
          ["V-03", "villa", 6],
          ["V-04", "villa", 6],
          ["V-05", "villa", 7],
          ["V-06", "villa", 7],
          ["T-01", "townhouse", 4],
          ["T-02", "townhouse", 4],
        ],
        { from: 310, step: 22.5 },
        { from: 1_850_000n * SAR, step: 185_000n * SAR },
      ),
      ...project(
        "مركز الأفق التجاري",
        [
          ["O-1", "office", 2],
          ["O-2", "office", 2],
          ["O-3", "office", 3],
          ["O-4", "office", 4],
          ["S-1", "shop", 0],
          ["S-2", "shop", 0],
          ["S-3", "shop", 0],
          ["S-4", "shop", 0],
        ],
        { from: 64, step: 19.75 },
        { from: 420_000n * SAR, step: 61_250n * SAR + 75n },
      ),
    ],
  },
  {
    company: "شركة المدار العقارية",
    users: [
      { email: "manager@madar.test", name: "عبدالله الحربي", role: "manager" },
      { email: "accountant@madar.test", name: "ريم الزهراني", role: "accountant" },
      {
        email: "rep1@madar.test",
        name: "ماجد المطيري",
        role: "sales_rep",
        clients: [
          { name: "هيفاء القرني", phone: "0501234501", notes: "تبحث عن شقة دوبلكس." },
          { name: "بندر العمري", phone: "0501234502", notes: "موظف حكومي، يفضّل التمويل البنكي." },
          { name: "جواهر الرشيدي", phone: "0501234503", notes: "" },
          { name: "صالح الدوسري", phone: "0501234504", notes: "طلب عرض سعر لفيلا في فلل النخيل." },
        ],
      },
      {
        email: "rep2@madar.test",
        name: "هند السبيعي",
        role: "sales_rep",
        clients: [
          { name: "عادل الشهراني", phone: "0591234501", notes: "يحتاج مكتبًا لا يقل عن 100 م²." },
          { name: "رهف المطيري", phone: "0591234502", notes: "" },
          { name: "خالد القحطاني", phone: "0591234503", notes: "متابعة الأسبوع القادم." },
          { name: "مشاعل العتيبي", phone: "0591234504", notes: "تفضّل الطوابق العليا." },
          { name: "فيصل الحارثي", phone: "0591234505", notes: "مهتم بالتقسيط على 3 سنوات." },
        ],
      },
    ],
    units: [
      ...project(
        "مجمع المدار السكني",
        [
          ["101", "apartment", 2],
          ["102", "apartment", 2],
          ["103", "apartment", 3],
          ["201", "apartment", 3],
          ["202", "apartment", 3],
          ["203", "apartment", 4],
          ["301", "duplex", 4],
          ["302", "duplex", 5],
        ],
        { from: 88, step: 16.5 },
        { from: 590_000n * SAR, step: 68_000n * SAR + 25n },
      ),
      ...project(
        "فلل النخيل",
        [
          ["N-1", "villa", 5],
          ["N-2", "villa", 5],
          ["N-3", "villa", 6],
          ["N-4", "villa", 6],
          ["N-5", "villa", 7],
          ["N-6", "townhouse", 4],
          ["N-7", "townhouse", 4],
          ["N-8", "townhouse", 5],
        ],
        { from: 290, step: 25 },
        { from: 1_720_000n * SAR, step: 196_500n * SAR },
      ),
      ...project(
        "برج المدار للأعمال",
        [
          ["10-A", "office", 2],
          ["10-B", "office", 2],
          ["11-A", "office", 3],
          ["11-B", "office", 3],
          ["12-A", "office", 4],
          ["G-1", "shop", 0],
          ["G-2", "shop", 0],
          ["G-3", "shop", 0],
        ],
        { from: 72, step: 18.25 },
        { from: 480_000n * SAR, step: 57_750n * SAR + 50n },
      ),
    ],
  },
];
