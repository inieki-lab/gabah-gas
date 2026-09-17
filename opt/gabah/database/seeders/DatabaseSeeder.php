<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AssetCategory;
use App\Models\Department;
use App\Models\Division;
use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Seed Core Divisions
        $it = Division::firstOrCreate(
            ['code' => 'IT'],
            ['name' => 'Information Technology', 'description' => 'Divisi Teknologi Informasi', 'is_active' => true]
        );
        $ga = Division::firstOrCreate(
            ['code' => 'GA'],
            ['name' => 'General Affair', 'description' => 'Divisi Umum & Operasional', 'is_active' => true]
        );
        $sc = Division::firstOrCreate(
            ['code' => 'SC'],
            ['name' => 'Supply Chain', 'description' => 'Divisi Rantai Pasok & Gudang', 'is_active' => true]
        );
        $pibc = Division::firstOrCreate(
            ['code' => 'PIBC'],
            ['name' => 'Pasar Induk Beras Cipinang', 'description' => 'Unit Operasional PIBC', 'is_active' => true]
        );

        // 2. Seed Initial Departments
        Department::firstOrCreate(['division_id' => $it->id, 'code' => 'IT-DEV'], ['name' => 'IT Development']);
        Department::firstOrCreate(['division_id' => $it->id, 'code' => 'IT-INFRA'], ['name' => 'IT Infrastructure & Support']);
        Department::firstOrCreate(['division_id' => $ga->id, 'code' => 'GA-OPS'], ['name' => 'GA Operations & Building']);
        Department::firstOrCreate(['division_id' => $sc->id, 'code' => 'SC-LOG'], ['name' => 'Logistics & Warehousing']);
        Department::firstOrCreate(['division_id' => $pibc->id, 'code' => 'PIBC-OPS'], ['name' => 'Operasional Pasar']);

        // 3. Seed Initial Locations
        Location::firstOrCreate(
            ['code' => 'HQ-HO'],
            ['name' => 'Head Office Food Station', 'building' => 'Gedung Utama', 'floor' => 'Lt. 2', 'address' => 'Jl. Pisangan Lama Timur, Cipinang']
        );
        Location::firstOrCreate(
            ['code' => 'GDG-CPN'],
            ['name' => 'Gudang Beras Cipinang', 'building' => 'Warehouse A', 'floor' => 'Lt. 1', 'address' => 'Komplek PIBC Cipinang']
        );
        Location::firstOrCreate(
            ['code' => 'PBR-SRG'],
            ['name' => 'Pabrik Pengolahan Sragen', 'building' => 'Rice Mill Unit 1', 'floor' => 'Ground', 'address' => 'Sragen, Jawa Tengah']
        );

        // 4. Seed Known Official Asset Categories with Authoritative Owner Divisions
        // Canonical IT Categories
        $itCategories = [
            ['code' => 'HLT', 'name' => 'Laptop', 'desc' => 'Laptop & Notebook'],
            ['code' => 'HPC', 'name' => 'Komputer / PC', 'desc' => 'Desktop PC'],
            ['code' => 'HSV', 'name' => 'Server', 'desc' => 'Physical & Virtual Server'],
            ['code' => 'HWS', 'name' => 'Workstation', 'desc' => 'High-performance Workstation'],
            ['code' => 'HMON', 'name' => 'Monitor', 'desc' => 'Monitor & Display Komputer'],
            ['code' => 'HPRN', 'name' => 'Printer', 'desc' => 'Printer Dokumen & Barcode'],
            ['code' => 'HSCN', 'name' => 'Scanner', 'desc' => 'Scanner Dokumen'],
            ['code' => 'HNET', 'name' => 'Network Device', 'desc' => 'Switch, Router, AP'],
            ['code' => 'HFW', 'name' => 'Firewall', 'desc' => 'Network Security Appliance'],
            ['code' => 'HSTG', 'name' => 'Storage', 'desc' => 'NAS & SAN Storage'],
            ['code' => 'HUPS', 'name' => 'UPS', 'desc' => 'Uninterruptible Power Supply'],
            ['code' => 'HRCK', 'name' => 'Rack', 'desc' => 'Server Rack Cabinet'],
            ['code' => 'HPWR', 'name' => 'Power Device', 'desc' => 'PDU & Inverter'],
            ['code' => 'HACC', 'name' => 'IT Accessory', 'desc' => 'Keyboard, Mouse, Docking'],
            ['code' => 'SLIC', 'name' => 'Software License', 'desc' => 'Software & SaaS License'],
        ];

        foreach ($itCategories as $c) {
            AssetCategory::firstOrCreate(
                ['code' => $c['code']],
                [
                    'name' => $c['name'],
                    'owner_division_id' => $it->id,
                    'category_type' => $c['code'] === 'SLIC' ? 'License' : 'IT',
                    'description' => $c['desc'],
                    'is_active' => true,
                ]
            );
        }

        // Canonical General Categories (GA & SC)
        $generalCategories = [
            ['code' => 'TNH', 'name' => 'Tanah', 'owner' => $ga->id, 'desc' => 'Aset Lahan & Tanah Perusahaan'],
            ['code' => 'BGN', 'name' => 'Bangunan', 'owner' => $ga->id, 'desc' => 'Gedung & Bangunan Fisik'],
            ['code' => 'KDR', 'name' => 'Kendaraan', 'owner' => $ga->id, 'desc' => 'Kendaraan Operasional & Dinas'],
            ['code' => 'INV-F', 'name' => 'Furniture', 'owner' => $ga->id, 'desc' => 'Meja, Kursi, Lemari (GA ALWAYS)'],
            ['code' => 'INV-P', 'name' => 'Peralatan/Perlengkapan', 'owner' => $ga->id, 'desc' => 'Peralatan Kerja & Toolkit'],
            ['code' => 'MSN', 'name' => 'Mesin', 'owner' => $sc->id, 'desc' => 'Mesin Produksi & Pengolahan Beras'],
            ['code' => 'LNY', 'name' => 'Lainnya', 'owner' => $ga->id, 'desc' => 'Aset Umum Lainnya'],
        ];

        foreach ($generalCategories as $g) {
            AssetCategory::firstOrCreate(
                ['code' => $g['code']],
                [
                    'name' => $g['name'],
                    'owner_division_id' => $g['owner'],
                    'category_type' => 'General',
                    'description' => $g['desc'],
                    'is_active' => true,
                ]
            );
        }

        // 5. Seed Permissions
        $permissions = [
            // Assets
            'assets.view', 'assets.create', 'assets.update', 'assets.delete', 'assets.assign', 'assets.move',
            // Loans
            'loans.view', 'loans.create', 'loans.approve', 'loans.handover', 'loans.return',
            // Tickets
            'tickets.view', 'tickets.create', 'tickets.assign', 'tickets.resolve', 'tickets.close',
            // Master Data & Users
            'master.view', 'master.manage', 'users.manage',
            // Reports & Audits
            'reports.view', 'audit.view',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // 6. Seed 9 Roles (GABAH Operational Roles)
        $roles = [
            'Management' => ['reports.view', 'assets.view', 'audit.view'],
            'Admin GABAH' => $permissions, // Superuser
            'IT' => ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.move', 'loans.view', 'loans.approve', 'tickets.view', 'tickets.assign', 'tickets.resolve', 'reports.view'],
            'GA' => ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.move', 'loans.view', 'loans.approve', 'tickets.view', 'reports.view'],
            'Supply Chain' => ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.move', 'tickets.view'],
            'PIBC' => ['assets.view', 'assets.create', 'assets.update', 'tickets.view'],
            'Karyawan' => ['assets.view', 'loans.create', 'loans.view', 'tickets.create', 'tickets.view'],
            'Auditor' => ['assets.view', 'loans.view', 'tickets.view', 'reports.view', 'audit.view', 'master.view'],
            'Vendor' => ['tickets.view'],
        ];

        foreach ($roles as $roleName => $rolePerms) {
            $role = Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
            $role->syncPermissions($rolePerms);
        }

        // 7. Seed Admin User
        $admin = User::firstOrCreate(
            ['email' => 'admin@foodstation.id'],
            [
                'name' => 'Administrator GABAH',
                'password' => Hash::make('FoodStation2026!'),
                'division_id' => $it->id,
                'phone' => '081100000001',
                'is_active' => true,
            ]
        );
        $admin->syncRoles(['Admin GABAH']);

        // 8. Seed Sample Users per Division
        $itUser = User::firstOrCreate(
            ['email' => 'it.support@foodstation.id'],
            [
                'name' => 'Staff IT Support',
                'password' => Hash::make('FoodStation2026!'),
                'division_id' => $it->id,
                'is_active' => true,
            ]
        );
        $itUser->syncRoles(['IT']);

        $gaUser = User::firstOrCreate(
            ['email' => 'ga.officer@foodstation.id'],
            [
                'name' => 'Officer GA',
                'password' => Hash::make('FoodStation2026!'),
                'division_id' => $ga->id,
                'is_active' => true,
            ]
        );
        $gaUser->syncRoles(['GA']);
    }
}
