import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import Product from '../../model/productSchema.js'
import Category from '../../model/categorySchema.js'
import User from '../../model/userSchema.js'
import multer from 'multer'
import upload from '../../middlewares/multer.js'


export const productInfo = async (req, res) => {
    try {
        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }
        let page = 1;
        if (req.query.page) {
            page = parseInt(req.query.page);
        }
        const limit = 5;
        let sort = 'createdAt';
        let order = 'desc';
        if (req.query.sort) {
            sort = req.query.sort;
        }
        if (req.query.order) {
            order = req.query.order;
        }
        const sortOrder = order === 'asc' ? 1 : -1;
        const productsData = await Product.find({
            productName: { $regex: ".*" + search + ".*", $options: 'i' }
        })
            .populate('category')
            .sort({ [sort]: sortOrder })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const count = await Product.find({
            productName: { $regex: ".*" + search + ".*", $options: 'i' }
        }).countDocuments();
        res.render('productList', {
            data: productsData,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            limit: limit,
            sort: sort,
            order: order
        });

    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageError")
    }
}



export const toggleProductListing = async (req, res) => {
    try {
        const productId = req.query.id;
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect("/admin/pageError")
        }
        const newStatus = !product.isBlocked;
        await Product.updateOne({ _id: productId }, { $set: { isBlocked: newStatus } });
        await Cart.updateMany(
            {}, 
            { $pull: { products: { productId } } } 
        );
        res.redirect("/admin/products");
    } catch (error) {
        console.error(error, "Error while toggling product listing status.");
        res.redirect("/admin/pageError")
    }
};

export const getAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        res.render('addProduct', { categories: categories})
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageError")
    }
}

const uploadImages = upload.array('productImages', 10);
export const addProduct = async (req, res) => {
    try {
        uploadImages(req, res, async (err) => {
            if (err) {
                console.error(err);
                return res.status(400).json({ error: "Error uploading files." });
            }
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: "No files uploaded." });
            }
            const imagePaths = req.files.map(file => file.path);
            const imageURL = imagePaths.map(path => path.replace('public\\', ''));
            const existingProduct = await Product.findOne({ productName:{ $regex: new RegExp(`^${req.body.productName}$`, 'i') }  });
            if (existingProduct) {
                return res.status(400).json({ error: productAlreadyExists });
            }
            
            const newProduct = new Product({
                productName: req.body.productName,
                description: req.body.description,
                category: req.body.category,
                productImages: imageURL,
                status: req.body.status,
                regularPrice: req.body.regularPrice,
                salePrice: req.body.salePrice,
                quantity: req.body.quantity,
            });
            await newProduct.save();
            return res.json({ message: "Product added successfully" });
        });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageError")
    }
};


export const getEditProduct = async (req, res) => {
    try {
        const productId = req.params.id
        const product = await Product.findById(productId)
        const categories = await Category.find({});
        const brands = await Brand.find({});
        res.render('product/editProduct', { categories: categories, product })
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageError")
    }
}


export const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        uploadImages(req, res, async (err) => {
            if (err) {
                console.error(err);
                return res.status(400).json({ error: "Error uploading files." });
            }
            const existingProduct = await Product.findById(productId);
            if (!existingProduct) {
                return res.status(404).json({ error: "Product not found" });
            }
            const AlreadyTakenName = await Product.findOne({ productName:{ $regex: new RegExp(`^${req.body.productName}$`, 'i') },_id: { $ne: productId }  });
            if (AlreadyTakenName) {
                return res.status(400).json({ error: productAlreadyExists });
            }
            let imageURL = [...existingProduct.productImages];

            if (req.body.removedImages && req.body.removedImages.length > 0) {
                const removedImages = Array.isArray(req.body.removedImages)
                    ? req.body.removedImages
                    : [req.body.removedImages];

                imageURL = imageURL.filter(img => !removedImages.includes(img));
            }
            if (req.files && req.files.length > 0) {
                const imagePaths = req.files.map(file => file.path);
                const newImageURLs = imagePaths.map(path => path.replace('public\\', ''));
                imageURL = imageURL.concat(newImageURLs);
            }
            imageURL = Array.isArray(imageURL) ? imageURL.flat() : [imageURL];
            let variations = [];
            if (Array.isArray(req.body.variations)) {
                variations = req.body.variations.map(variation => ({
                    size: variation.size,
                    regularPrice: parseFloat(variation.regularPrice),
                    salePrice: parseFloat(variation.salePrice),
                    quantity: parseInt(variation.quantity, 10),
                }));
            }
            const updateProduct = await Product.findByIdAndUpdate(productId, {
                productName: req.body.productName,
                description: req.body.description,
                brand: req.body.brands,
                category: req.body.category,
                variations: variations,
                gender: req.body.gender,
                productImages: imageURL,
                status: req.body.status,
            }, { new: true });
            // console.log('new updated data', updateProduct)
            if (updateProduct) {
                res.json({ message: "Product updated successfully" });
            } else {
                res.status(404).json({ error: "Product not found" });
            }

        });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageError")
    }
};








// export const productTable = async (req,res) => {
//     try {
//         res.render('productList')
//     } catch (error) {
//         console.log(error, 'Error at Product table');
//         res.render('error')
//     }
// }

// export const loadAddProduct = async (req,res) => {

//     try {

//         const category = await Category.find({isListed:true})
//         res.render('addProduct',{cat:category});
//     } catch (error) {
//         res.redirect('/admin/apagenotfound')       
//     }
// }

// export const uploadImages = upload.array('productImages', 10);



// export const addProduct = async (req, res) => {
//     try {
//         uploadImages(req, res, async (err) => {
//             if (err) {
//                 console.error(err);
//                 return res.status(400).json({ error: "Error uploading files." });
//             }
//             if (!req.files || req.files.length === 0) {
//                 return res.status(400).json({ error: "No files uploaded." });
//             }
//             const imagePaths = req.files.map(file => file.path);
//             const imageURL = imagePaths.map(path => path.replace('public\\', ''));
//             const existingProduct = await Product.findOne({ productName:{ $regex: new RegExp(`^${req.body.productName}$`, 'i') }  });
//             if (existingProduct) {
//                 return res.status(400).json({ error: productAlreadyExists });
//             }
//             const newProduct = new Product({
//                 productName: req.body.productName,
//                 description: req.body.description,
//                 category: req.body.category,
//                 productImages: imageURL,
//                 status: req.body.status,
//                 regularPrice: req.body.regularPrice,
//                 salePrice: req.body.salePrice,
//                 quantity: req.body.stock
//             });
//             await newProduct.save();
//             return res.json({ message: "Product added successfully" });
//         });
//     } catch (error) {
//         console.error(error);
//         res.redirect("/admin/pageError")
//     }
// };



// export const addProduct = async (req,res) => {
//     try {
//         const products = req.body;
//         const productExists = await Product.findOne({
//             productName:products.productName,

//         });

//         if(!productExists){
//             const images = [];

//             if(req.files  && req.file.length>0){
//                 for(let i=0;i<req.files.length;i++){
//                     const orginalImagePath = req.file[i].path;
//                     const resizedImapePath = path.join('public','uploads','products',req.files[i].filename);
//                     await sharp(orginalImagePath).resize({width:440,height:440}).toFile(resizedImapePath);
//                     images.push(req.files[i].filename);
//                 }
//             }

//             const categoryId = await Category.findOne({name:products.category});

//             if(!categoryId){
//                 return req.status(400).join('Invalid Category name');
//             }

//             const newProduct = new Product({
//                 productName:products.productName,
//                 description:products.description,
//                 category:categoryId._id,
//                 stock:products.stock,
//                 regularPrice:products.regularPrice,
//                 salePrice:products.salePrice,
//                 createdAr: new Date(),
//                 productImage:images,
//                 status:'Listed'
//             })
//             await newProduct.save()
//             return res.redirect('/admin/addProduct')
//         }else{
//             return res.status(400).json('Product Already Exist With the same name try another one')
//         }
//     } catch (error) {
//         return res.status(500).json('Internal Server error')
//         console.log(error)
//     }
// }


// export const loadEditProduct = async (req,res) => {
    
// }

// export const editProduct = async (req,res) => {
    
// }