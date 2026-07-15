

async function test() {
    try {
        const res = await fetch('http://localhost:5173/api/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                site_name: 'Test',
                allow_registration: 1,
                admin_username: 'admin',
                admin_email: 'admin@test.com',
                admin_password: 'password123'
            })
        });
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

test();
