(module
 (type $none_=>_i32 (func (result i32)))
 (type $none_=>_none (func))
 (type $i32_=>_none (func (param i32)))
 (type $i32_=>_i32 (func (param i32) (result i32)))
 (import "wasi_snapshot_preview1" "proc_exit" (func $fimport$0 (param i32)))
 (global $global$0 (mut i32) (i32.const 65536))
 (global $global$1 (mut i32) (i32.const 0))
 (global $global$2 (mut i32) (i32.const 0))
 (memory $0 256 256)
 (table $0 2 2 funcref)
 (elem (i32.const 1) $0)
 (export "memory" (memory $0))
 (export "__indirect_function_table" (table $0))
 (export "_start" (func $2))
 (export "__errno_location" (func $15))
 (export "emscripten_stack_init" (func $11))
 (export "emscripten_stack_get_free" (func $12))
 (export "emscripten_stack_get_base" (func $13))
 (export "emscripten_stack_get_end" (func $14))
 (export "stackSave" (func $7))
 (export "stackRestore" (func $8))
 (export "stackAlloc" (func $9))
 (export "emscripten_stack_get_current" (func $10))
 (func $0
  (call $11)
 )
 (func $1 (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local.set $0
   (global.get $global$0)
  )
  (local.set $1
   (i32.const 16)
  )
  (local.set $2
   (i32.sub
    (local.get $0)
    (local.get $1)
   )
  )
  (local.set $3
   (i32.const 0)
  )
  (i32.store offset=12
   (local.get $2)
   (local.get $3)
  )
  (local.set $4
   (i32.const 0)
  )
  (return
   (local.get $4)
  )
 )
 (func $2
  (block $label$1
   (br_if $label$1
    (i32.eqz
     (i32.const 1)
    )
   )
   (call $0)
  )
  (call $5
   (call $1)
  )
  (unreachable)
 )
 (func $3
 )
 (func $4
  (local $0 i32)
  (local.set $0
   (i32.const 0)
  )
  (block $label$1
   (br_if $label$1
    (i32.le_u
     (i32.const 0)
     (i32.const 0)
    )
   )
   (loop $label$2
    (call_indirect (type $none_=>_none)
     (i32.load
      (local.tee $0
       (i32.add
        (local.get $0)
        (i32.const -4)
       )
      )
     )
    )
    (br_if $label$2
     (i32.gt_u
      (local.get $0)
      (i32.const 0)
     )
    )
   )
  )
  (call $3)
 )
 (func $5 (param $0 i32)
  (call $3)
  (call $4)
  (call $3)
  (call $6
   (local.get $0)
  )
  (unreachable)
 )
 (func $6 (param $0 i32)
  (call $fimport$0
   (local.get $0)
  )
  (unreachable)
 )
 (func $7 (result i32)
  (global.get $global$0)
 )
 (func $8 (param $0 i32)
  (global.set $global$0
   (local.get $0)
  )
 )
 (func $9 (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (global.set $global$0
   (local.tee $1
    (i32.and
     (i32.sub
      (global.get $global$0)
      (local.get $0)
     )
     (i32.const -16)
    )
   )
  )
  (local.get $1)
 )
 (func $10 (result i32)
  (global.get $global$0)
 )
 (func $11
  (global.set $global$2
   (i32.const 65536)
  )
  (global.set $global$1
   (i32.and
    (i32.add
     (i32.const 0)
     (i32.const 15)
    )
    (i32.const -16)
   )
  )
 )
 (func $12 (result i32)
  (i32.sub
   (global.get $global$0)
   (global.get $global$1)
  )
 )
 (func $13 (result i32)
  (global.get $global$2)
 )
 (func $14 (result i32)
  (global.get $global$1)
 )
 (func $15 (result i32)
  (i32.const 65536)
 )
)