import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Laluan sementara untuk menyemai data ujian bagi tenant aktif.
 *
 * AMARAN: Laluan ini hanya untuk pembangunan/ujian. Ia menggunakan klien
 * service-role (memintas RLS) dan menulis data contoh ke dalam pangkalan data.
 * Padam fail ini sebelum ke pengeluaran.
 *
 * Hanya menulis ke jadual `classes` dan `students`. Tiada penulisan ke
 * jadual hubungan (contoh: student_emergency_contacts / student_parents).
 *
 * POST /api/seed/students
 */

interface SeedStudent {
  full_name: string;
  nickname: string;
  mykid_number: string;
  dob: string;
  gender: 'L' | 'P';
  blood_type: string;
  allergies: string[] | null;
  medical_conditions: string | null;
  special_notes: string | null;
}

interface SeedClass {
  class_name: string;
  year: number;
  students: SeedStudent[];
}

const SEED_CLASSES: SeedClass[] = [
  {
    class_name: 'Kelas 2 Tahun',
    year: 2,
    students: [
      {
        full_name: 'Nur Aisyah binti Rahman',
        nickname: 'Aisyah',
        mykid_number: '150203-14-0123',
        dob: '2023-02-14',
        gender: 'P',
        blood_type: 'O',
        allergies: ['Kacang tanah'],
        medical_conditions: null,
        special_notes: 'Ibu: Siti Nurhaliza binti Ahmad (012-3456789). Suka menyanyi dan menari.',
      },
      {
        full_name: 'Muhammad Adam bin Zulkifli',
        nickname: 'Adam',
        mykid_number: '150518-10-0456',
        dob: '2023-05-18',
        gender: 'L',
        blood_type: 'A',
        allergies: null,
        medical_conditions: null,
        special_notes: 'Bapa: Zulkifli bin Hassan (013-9876543). Aktif dan suka bermain di luar.',
      },
      {
        full_name: 'Tan Jia Hui',
        nickname: 'Jia Hui',
        mykid_number: '150811-14-0789',
        dob: '2023-08-11',
        gender: 'P',
        blood_type: 'B',
        allergies: ['Telur'],
        medical_conditions: 'Asma ringan',
        special_notes: 'Bapa: Tan Wei Ming (016-2223344). Perlu penyedut (inhaler) jika sesak nafas.',
      },
    ],
  },
  {
    class_name: 'Kelas 3 Tahun',
    year: 3,
    students: [
      {
        full_name: 'Nurul Huda binti Ismail',
        nickname: 'Huda',
        mykid_number: '140305-06-0234',
        dob: '2022-03-05',
        gender: 'P',
        blood_type: 'AB',
        allergies: null,
        medical_conditions: null,
        special_notes: 'Ibu: Noraini binti Yusof (011-12345678). Sangat pemalu, perlukan masa menyesuaikan diri.',
      },
      {
        full_name: 'Muhammad Danial bin Roslan',
        nickname: 'Danial',
        mykid_number: '140622-08-0567',
        dob: '2022-06-22',
        gender: 'L',
        blood_type: 'O',
        allergies: ['Susu lembu'],
        medical_conditions: null,
        special_notes: 'Bapa: Roslan bin Abdullah (019-8765432). Alahan laktosa — elakkan produk tenusu.',
      },
      {
        full_name: 'Kavitha a/p Suresh',
        nickname: 'Kavitha',
        mykid_number: '140917-10-0891',
        dob: '2022-09-17',
        gender: 'P',
        blood_type: 'A',
        allergies: null,
        medical_conditions: null,
        special_notes: 'Bapa: Suresh a/l Ramasamy (012-3334455). Suka melukis dan mewarna.',
      },
      {
        full_name: 'Muhammad Harith bin Faizal',
        nickname: 'Harith',
        mykid_number: '141120-14-0321',
        dob: '2022-11-20',
        gender: 'L',
        blood_type: 'B',
        allergies: ['Debu'],
        medical_conditions: null,
        special_notes: 'Bapa: Faizal bin Omar (017-5556677). Aktif dalam aktiviti luar bilik darjah.',
      },
    ],
  },
  {
    class_name: 'Kelas 4 Tahun',
    year: 4,
    students: [
      {
        full_name: 'Nur Balqis binti Azman',
        nickname: 'Balqis',
        mykid_number: '130412-06-0456',
        dob: '2021-04-12',
        gender: 'P',
        blood_type: 'O',
        allergies: null,
        medical_conditions: null,
        special_notes: 'Bapa: Azman bin Salleh (013-4445566). Pemimpin kecil dalam kalangan rakan sebaya.',
      },
      {
        full_name: 'Muhammad Irfan bin Kamarudin',
        nickname: 'Irfan',
        mykid_number: '130728-08-0789',
        dob: '2021-07-28',
        gender: 'L',
        blood_type: 'A',
        allergies: ['Seafood'],
        medical_conditions: null,
        special_notes: 'Bapa: Kamarudin bin Idris (014-7778899). Alahan makanan laut — perlu dipantau semasa waktu makan.',
      },
      {
        full_name: 'Chong Mei Ling',
        nickname: 'Mei Ling',
        mykid_number: '131105-14-0123',
        dob: '2021-11-05',
        gender: 'P',
        blood_type: 'AB',
        allergies: null,
        medical_conditions: null,
        special_notes: 'Bapa: Chong Kok Wai (016-9990011). Suka bercerita dan aktif dalam aktiviti berkumpulan.',
      },
    ],
  },
];

export async function POST() {
  // 1. Sahkan sesi dan dapatkan tenant aktif pengguna.
  const profile = await getCurrentUser();
  if (!profile) {
    return NextResponse.json(
      { error: 'Sesi tidak sah. Sila log masuk semula.' },
      { status: 401 }
    );
  }

  const tenantId = profile.tenant_id;
  const admin = createAdminClient();

  let studentsInserted = 0;

  try {
    for (const seedClass of SEED_CLASSES) {
      // 2. Cipta kelas (elak duplikasi: guna semula jika sudah wujud).
      const { data: existingClass } = await admin
        .from('classes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('class_name', seedClass.class_name)
        .maybeSingle();

      let classId: string;
      if (existingClass?.id) {
        classId = existingClass.id;
      } else {
        const { data: newClass, error: classErr } = await admin
          .from('classes')
          .insert({
            tenant_id: tenantId,
            class_name: seedClass.class_name,
            year: seedClass.year,
          })
          .select('id')
          .single();

        if (classErr || !newClass) {
          throw new Error(
            `Gagal mencipta kelas "${seedClass.class_name}": ${classErr?.message ?? 'tiada data'}`
          );
        }
        classId = newClass.id;
      }

      // 3. Masukkan anak bagi kelas ini (hanya jadual `students`).
      for (const s of seedClass.students) {
        const { error: studentErr } = await admin.from('students').insert({
          tenant_id: tenantId,
          class_id: classId,
          full_name: s.full_name,
          nickname: s.nickname,
          mykid_number: s.mykid_number,
          dob: s.dob,
          gender: s.gender,
          blood_type: s.blood_type,
          allergies: s.allergies,
          medical_conditions: s.medical_conditions,
          special_notes: s.special_notes,
        });

        if (studentErr) {
          throw new Error(
            `Gagal memasukkan anak "${s.full_name}": ${studentErr.message}`
          );
        }
        studentsInserted += 1;
      }
    }

    return NextResponse.json({ success: true, studentsInserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ralat tidak diketahui';
    console.error('[api/seed/students] gagal:', message);
    return NextResponse.json(
      { success: false, studentsInserted, error: message },
      { status: 500 }
    );
  }
}
