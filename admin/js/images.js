// ============================================
// CHOICE KART Admin - Image Upload to Supabase Storage
// ============================================
// Handles uploading images to the "images" bucket in Supabase Storage.
// Provides upload handlers for product and category image file inputs.
// Depends on: db (supabase-config.js), utils.js

let imageUploading = false;

/**
 * Upload an image file to Supabase Storage.
 * @param {File} file - The file to upload
 * @param {string} folder - Storage folder path (e.g. 'products', 'categories', 'banners')
 * @returns {string|null} Public URL of the uploaded file, or null on error
 */
async function uploadImage(file, folder = 'products') {
    const fileExt = file.name.split('.').pop().toLowerCase();
    // Generate a unique filename to avoid collisions
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    imageUploading = true;

    const { data, error } = await db.storage
        .from('images')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    imageUploading = false;

    if (error) {
        console.error('Upload error:', error);
        // Provide helpful error messages for common setup issues
        if (error.message && error.message.includes('Bucket not found')) {
            showToast('Create a storage bucket named "images" in Supabase → Storage', 'error');
        } else if (error.message && (error.message.includes('security') || error.message.includes('policy') || error.message.includes('violates'))) {
            showToast('Storage needs upload policy. Run the SQL below in Supabase SQL Editor.', 'error');
            console.log('%c RUN THIS SQL IN SUPABASE SQL EDITOR:', 'color:red;font-weight:bold;');
            console.log(`CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'images');`);
            console.log(`CREATE POLICY "Allow public reads" ON storage.objects FOR SELECT USING (bucket_id = 'images');`);
        } else {
            showToast('Upload failed: ' + error.message, 'error');
        }
        return null;
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = db.storage.from('images').getPublicUrl(data.path);
    console.log('Image uploaded:', urlData.publicUrl);
    return urlData.publicUrl;
}

// ===== PRODUCT IMAGE UPLOAD HANDLER =====
document.getElementById('productImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show preview immediately using a local blob URL
    const preview = document.getElementById('productImagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';

    showToast('Uploading image...', 'warning');
    const url = await uploadImage(file, 'products');
    if (url) {
        document.getElementById('productImageUrl').value = url;
        showToast('Image uploaded!');
    } else {
        showToast('Image upload failed — check console (F12) for details', 'error');
    }
});

// ===== CATEGORY IMAGE UPLOAD HANDLER =====
document.getElementById('categoryImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('categoryImagePreview');
    preview.src = URL.createObjectURL(file);
    preview.style.display = 'block';

    showToast('Uploading image...', 'warning');
    const url = await uploadImage(file, 'categories');
    if (url) {
        document.getElementById('categoryImageUrl').value = url;
        showToast('Image uploaded!');
    } else {
        showToast('Image upload failed — check console (F12) for details', 'error');
    }
});
